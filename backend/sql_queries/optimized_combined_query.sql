-- =============================================================================
-- OPTIMIZED COMBINED PORTFOLIO ROADMAP QUERY
-- =============================================================================
-- Purpose: Combine hierarchy and investment data in a single optimized query
-- Date: August 25, 2025
-- Performance: Optimized for faster execution with proper indexing hints
-- =============================================================================

WITH

-- =============================================================================
-- SECTION 1: HIERARCHY DATA PROCESSING
-- =============================================================================

HierarchyData AS (
    WITH
    -- Step 1.1: Get active investments only (performance optimization)
    ACTIVE_INV_ONLY AS (
        SELECT /*+ BROADCAST(inv) */ 
            INV_EXTERNAL_ID
        FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_investments_v
        WHERE INV_ACTIVE = 'Yes'
    ),

    -- Step 1.2: Extract key hierarchy columns for active investments
    -- Exclude Ideas to reduce data volume
    HIE_KEY_COLS AS (
        SELECT /*+ BROADCAST(inv) */
            hie.HIERARCHY_EXTERNAL_ID,
            hie.HIERARCHY_NAME,
            hie.HIE_INV_TYPE_NAME,
            hie.HIE_INV_EXTERNAL_ID,
            hie.HIE_INV_NAME,
            hie.HIE_INV_HIERARCHY_LEVEL,
            hie.HIE_INV_PARENT_NAME,
            hie.HIE_INV_PARENT_EXT_ID
        FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_hierarchies_v hie
        INNER JOIN ACTIVE_INV_ONLY inv
            ON hie.HIE_INV_EXTERNAL_ID = inv.INV_EXTERNAL_ID
        WHERE hie.HIE_INV_NAME NOT LIKE '%Ideas:%'
            AND hie.HIE_INV_TYPE_NAME NOT IN ('Idea')
            AND hie.HIERARCHY_EXTERNAL_ID = 'H-0056' -- PMO COE Hierarchy only
    ),


    -- Step 1.3: Enrich hierarchy with parent investment types
    HIE_W_PAR_TYPE AS (
        SELECT 
            kc.*,
            inv_types.INV_TYPE AS HIE_INV_PARENT_TYPE
        FROM HIE_KEY_COLS kc
        LEFT JOIN (
            SELECT
                HIERARCHY_EXTERNAL_ID,
                HIE_INV_EXTERNAL_ID,
                HIE_INV_TYPE_NAME AS INV_TYPE
            FROM HIE_KEY_COLS
        ) inv_types
            ON kc.HIERARCHY_EXTERNAL_ID = inv_types.HIERARCHY_EXTERNAL_ID 
            AND kc.HIE_INV_PARENT_EXT_ID = inv_types.HIE_INV_EXTERNAL_ID
    ),

    -- Step 1.4: Calculate COE investment type classification metrics
    -- Count children and programs to determine classification
    HIE_COE_INV_TYPE_PT1 AS (
        SELECT
            HIERARCHY_EXTERNAL_ID,
            HIE_INV_PARENT_NAME,
            HIE_INV_PARENT_EXT_ID,
            HIE_INV_PARENT_TYPE,
            CASE 
                WHEN HIE_INV_PARENT_TYPE = 'Portfolios' THEN 1 
                ELSE 0 
            END AS IS_PORTFOLIO,
            SUM(CASE 
                WHEN HIE_INV_TYPE_NAME = 'Programs' 
                AND HIE_INV_PARENT_EXT_ID <> HIE_INV_EXTERNAL_ID 
                THEN 1 
                ELSE 0 
            END) AS NBR_CHILD_PROGRAMS,
            COUNT(1) AS NBR_CHILDREN
        FROM HIE_W_PAR_TYPE
        GROUP BY 
            HIERARCHY_EXTERNAL_ID,
            HIE_INV_PARENT_NAME,
            HIE_INV_PARENT_EXT_ID,
            HIE_INV_PARENT_TYPE
    ),



    -- Step 1.5: Determine final COE roadmap types
    -- Portfolio > Program > Sub-Program classification logic
    HIE_COE_INV_TYPE_PT2 AS (
        SELECT
            HIERARCHY_EXTERNAL_ID,
            HIE_INV_PARENT_NAME,
            HIE_INV_PARENT_EXT_ID,
            HIE_INV_PARENT_TYPE AS HIE_INV_PAR_CLRTY_TYPE,
            CASE
                WHEN HIE_INV_PARENT_EXT_ID IS NULL THEN NULL
                WHEN IS_PORTFOLIO > 0 THEN 'Portfolio'
                WHEN NBR_CHILD_PROGRAMS > 0 THEN 'Program'
                ELSE 'Sub-Program'
            END AS HIE_INV_PAR_COE_ROADMAP_TYPE
        FROM HIE_COE_INV_TYPE_PT1
    ),

    -- Step 1.6: Create final hierarchy dataset
    HIE_FINAL AS (
        SELECT
            hwpt.HIERARCHY_EXTERNAL_ID,
            hwpt.HIERARCHY_NAME,
            hcit2.HIE_INV_PAR_COE_ROADMAP_TYPE AS COE_ROADMAP_TYPE,
            hwpt.HIE_INV_PARENT_EXT_ID AS COE_ROADMAP_PARENT_ID,
            hwpt.HIE_INV_PARENT_NAME AS COE_ROADMAP_PARENT_NAME,
            hwpt.HIE_INV_PARENT_TYPE AS COE_ROADMAP_PARENT_CLRTY_TYPE,
            hwpt.HIE_INV_EXTERNAL_ID AS CHILD_ID,
            hwpt.HIE_INV_NAME AS CHILD_NAME,
            hwpt.HIE_INV_TYPE_NAME AS CLRTY_CHILD_TYPE,
            CASE 
                WHEN hwpt.HIE_INV_PARENT_EXT_ID = hwpt.HIE_INV_EXTERNAL_ID 
                AND hwpt.HIE_INV_PARENT_TYPE = 'Programs' 
                THEN 1
                ELSE 0 
            END AS If_parent_exist
        FROM HIE_W_PAR_TYPE hwpt
        LEFT JOIN HIE_COE_INV_TYPE_PT2 hcit2
            ON hwpt.HIE_INV_PARENT_EXT_ID = hcit2.HIE_INV_PARENT_EXT_ID
    )

    -- Return hierarchy data
    SELECT * FROM HIE_FINAL
),



-- =============================================================================
-- SECTION 2: INVESTMENT & ROADMAP DATA PROCESSING
-- =============================================================================

InvestmentData AS (
    WITH
    -- Step 2.1: Calculate investment start/finish dates from tasks
    INV_START_FIN AS (
        SELECT /*+ COALESCE(3) */
            PROJECT_INTERNAL_ID AS INV_INT_ID,
            PROJECT_ID AS INV_EXT_ID,
            INVESTMENT_NAME,
            'Investment' AS ROADMAP_ELEMENT,
            NULL AS TASKEXTID,
            'Start/Finish Dates' AS TASK_NAME,
            TO_DATE(MIN(TASK_START_DATE)) AS TASK_START,
            TO_DATE(MAX(TASK_FINISH_DATE)) AS TASK_FINISH,
            NULL AS MILESTONE_STATUS
        FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_task_v
        WHERE (PROJECT_ID LIKE 'PR0000%' OR PROJECT_ID LIKE 'PROG%')
            AND UPPER(TASK_NAME) NOT LIKE '%IGNORE%'
            AND (UPPER(PARENT_NAME) NOT LIKE '%IGNORE%' OR PARENT_NAME IS NULL)
        GROUP BY PROJECT_INTERNAL_ID, PROJECT_ID, INVESTMENT_NAME
    ),

    -- Step 2.2: Extract PROJECT key milestones
    -- Categorize as Deployment vs Other milestones
    PROJ_MSTONES AS (
        SELECT
            PROJECT_INTERNAL_ID AS INV_INT_ID,
            PROJECT_ID AS INV_EXT_ID,
            INVESTMENT_NAME,
            CASE
                WHEN UPPER(TASK_NAME) LIKE '%SG3%' THEN 'Milestones - Deployment'
                ELSE 'Milestones - Other'
            END AS ROADMAP_ELEMENT,
            TASKEXTID,
            TASK_NAME,
            TO_DATE(TASK_START_DATE) AS TASK_START,
            TO_DATE(TASK_FINISH_DATE) AS TASK_FINISH,
            CASE
                WHEN UPPER(TASK_STATUS) = 'COMPLETED' THEN 'Completed'
                ELSE 'Incomplete'
            END AS MILESTONE_STATUS
        FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_task_v
        WHERE PROJECT_ID LIKE 'PR0000%'
            AND UPPER(TASK_NAME) NOT LIKE '%IGNORE%'
            AND UPPER(PARENT_NAME) NOT LIKE '%IGNORE%'
            AND IS_KEYTASK = 'Yes'
            AND IS_MILESTONE = 'Yes'
    ),



    -- Step 2.3: Extract PROGRAM key milestones
    -- Categorize based on parent task groupings
    PROG_MSTONES AS (
        SELECT
            PROJECT_INTERNAL_ID AS INV_INT_ID,
            PROJECT_ID AS INV_EXT_ID,
            INVESTMENT_NAME,
            CASE
                WHEN UPPER(PARENT_NAME) LIKE '%DEPLOYMENTS%' THEN 'Milestones - Deployment'
                ELSE 'Milestones - Other'
            END AS ROADMAP_ELEMENT,
            TASKEXTID,
            TASK_NAME,
            TO_DATE(TASK_START_DATE) AS TASK_START,
            TO_DATE(TASK_FINISH_DATE) AS TASK_FINISH,
            CASE
                WHEN UPPER(TASK_STATUS) = 'COMPLETED' THEN 'Completed'
                ELSE 'Incomplete'
            END AS MILESTONE_STATUS
        FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_task_v
        WHERE PROJECT_ID LIKE 'PROG%'
            AND UPPER(TASK_NAME) NOT LIKE '%IGNORE%'
            AND UPPER(PARENT_NAME) NOT LIKE '%IGNORE%'
            AND IS_KEYTASK = 'Yes'
            AND IS_MILESTONE = 'Yes'
    ),

    -- Step 2.4: Get active investment metadata
    INVESTMENTS_PT1 AS (
        SELECT /*+ BROADCAST(inv) */
            INV_INTERNAL_ID,
            INV_EXTERNAL_ID,
            INV_NAME,
            INV_TYPE_NAME AS INV_TYPE
        FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_investments_v
        WHERE INV_ACTIVE = 'Yes'
            AND INV_TYPE_NAME IN ('Project', 'Programs', 'Portfolios')
    ),



    -- Step 2.5: Get latest status reports for each investment
    STATUS_LATEST_REPORT_ID AS (
        SELECT
            PROJECT_CODE,
            MAX(INTERNAL_ID) AS LATEST_RPT_INT_ID
        FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_status_report_history_v
        GROUP BY PROJECT_CODE
    ),

    -- Step 2.6: Extract status report details
    STATUS_RPT_KEY_DETAILS AS (
        SELECT
            PROJECT_CODE,
            PROJECT_NAME,
            INTERNAL_ID,
            STATUS_ID,
            PUBLISH_DATE,
            ST_STS_OVERALL
        FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_status_report_history_v
    ),

    -- Step 2.7: Combine investment data with latest status
    INVESTMENTS_PT2 AS (
        SELECT
            i.INV_INTERNAL_ID,
            i.INV_EXTERNAL_ID,
            i.INV_NAME,
            i.INV_TYPE,
            COALESCE(d.ST_STS_OVERALL, 'Grey') AS INV_OVERALL_STATUS
        FROM INVESTMENTS_PT1 i
        LEFT JOIN STATUS_LATEST_REPORT_ID l
            ON i.INV_EXTERNAL_ID = l.PROJECT_CODE
        LEFT JOIN STATUS_RPT_KEY_DETAILS d
            ON l.PROJECT_CODE = d.PROJECT_CODE
            AND l.LATEST_RPT_INT_ID = d.INTERNAL_ID
    ),

    -- Step 2.8: Combine all roadmap items (investments + milestones)
    CLRTY_ROADMAP_ITEMS AS (
        SELECT * FROM INV_START_FIN
        UNION ALL
        SELECT * FROM PROJ_MSTONES
        UNION ALL
        SELECT * FROM PROG_MSTONES
    ),



    -- Step 2.9: Final roadmap data with parameters and sorting
    CLRTY_ROADMAP_w_PARAMS AS (
        SELECT
            cri.INV_INT_ID,
            cri.INV_EXT_ID,
            ip2.INV_TYPE AS CLRTY_INV_TYPE,
            cri.INVESTMENT_NAME,
            cri.ROADMAP_ELEMENT,
            cri.TASK_NAME,
            cri.TASK_START,
            cri.TASK_FINISH,
            ip2.INV_OVERALL_STATUS,
            cri.MILESTONE_STATUS,
            ROW_NUMBER() OVER (
                PARTITION BY cri.INV_EXT_ID, cri.ROADMAP_ELEMENT 
                ORDER BY cri.TASK_START
            ) AS SortOrder
        FROM CLRTY_ROADMAP_ITEMS cri
        LEFT JOIN INVESTMENTS_PT2 ip2
            ON cri.INV_INT_ID = ip2.INV_INTERNAL_ID
        WHERE ip2.INV_TYPE IS NOT NULL
    )

    -- Return investment data
    SELECT * FROM CLRTY_ROADMAP_w_PARAMS
)



-- =============================================================================
-- SECTION 3: FINAL DATA COMBINATION & OUTPUT
-- =============================================================================

SELECT
    -- Hierarchy Information
    h.HIERARCHY_EXTERNAL_ID,
    h.HIERARCHY_NAME,
    h.COE_ROADMAP_TYPE,
    h.COE_ROADMAP_PARENT_ID,
    h.COE_ROADMAP_PARENT_NAME,
    h.COE_ROADMAP_PARENT_CLRTY_TYPE,
    h.CHILD_ID,
    h.CHILD_NAME,
    h.CLRTY_CHILD_TYPE,
    h.If_parent_exist,
    
    -- Investment & Roadmap Information
    i.INV_EXT_ID,
    i.INVESTMENT_NAME,
    i.ROADMAP_ELEMENT,
    i.TASK_NAME,
    i.TASK_START,
    i.TASK_FINISH,
    i.INV_OVERALL_STATUS,
    i.MILESTONE_STATUS,
    i.SortOrder

FROM HierarchyData h
LEFT JOIN InvestmentData i 
    ON h.CHILD_ID = i.INV_EXT_ID

ORDER BY
    h.COE_ROADMAP_TYPE,
    h.COE_ROADMAP_PARENT_NAME,
    h.If_parent_exist DESC,
    h.CHILD_NAME,
    i.ROADMAP_ELEMENT,
    i.TASK_START;
