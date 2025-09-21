WITH 

	-- ### Get a list of active investments only
	ACTIVE_INV_ONLY AS (
		SELECT
		  INV_EXTERNAL_ID
		FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_investments_v
		WHERE INV_ACTIVE = 'Yes'
	),

	-- ### Show key columns from hierarchy table for active investments where not relating to Ideas
	HIE_KEY_COLS AS (
		SELECT
		  hie.HIERARCHY_EXTERNAL_ID
		  , hie.HIERARCHY_NAME
		  , hie.HIE_INV_TYPE_NAME
		  , hie.HIE_INV_EXTERNAL_ID
		  , hie.HIE_INV_NAME
		  , hie.HIE_INV_HIERARCHY_LEVEL
		  , hie.HIE_INV_PARENT_NAME
		  , hie.HIE_INV_PARENT_EXT_ID
		FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_hierarchies_v hie
		INNER JOIN ACTIVE_INV_ONLY inv
		  ON hie.HIE_INV_EXTERNAL_ID = inv.INV_EXTERNAL_ID
		WHERE HIE_INV_NAME NOT LIKE '%Ideas:%'
		  AND HIE_INV_TYPE_NAME NOT IN ('Idea')
		  AND HIERARCHY_EXTERNAL_ID = 'H-0056' -- PMO COE Hierarchy only ('H-0056') //'H-0101' is also good for testing against
	),

	-- ### Join the parent's type to the hierarchy table
	HIE_W_PAR_TYPE AS (
		SELECT
		  kc.*
		  , inv_types.INV_TYPE AS HIE_INV_PARENT_TYPE
		FROM HIE_KEY_COLS kc
		LEFT JOIN (
			SELECT
			  HIERARCHY_EXTERNAL_ID
			  , HIE_INV_EXTERNAL_ID
			  , HIE_INV_TYPE_NAME AS INV_TYPE
			FROM HIE_KEY_COLS
		) inv_types
		  ON ( kc.HIERARCHY_EXTERNAL_ID = inv_types.HIERARCHY_EXTERNAL_ID ) AND ( kc.HIE_INV_PARENT_EXT_ID = inv_types.HIE_INV_EXTERNAL_ID )
	),

	-- ### Identify portfolios to exclude, namely those whose have >=1 portfolios as children
	HIE_VALID_PARENTS_PT1 AS (
		SELECT
		  HIERARCHY_EXTERNAL_ID
		  , HIE_INV_PARENT_EXT_ID
		  , HIE_INV_PARENT_NAME
		  , HIE_INV_PARENT_TYPE
		  , SUM( CASE WHEN HIE_INV_TYPE_NAME = 'Portfolios' THEN 1 END ) AS CHILD_PORTFOLIOS
		  , CASE WHEN CHILD_PORTFOLIOS > 0 THEN 'Y' ELSE 'N' END AS EXCLUDE_PORTFOLIO
		FROM HIE_W_PAR_TYPE
		GROUP BY HIERARCHY_EXTERNAL_ID, HIE_INV_PARENT_EXT_ID, HIE_INV_PARENT_NAME, HIE_INV_PARENT_TYPE
	),

	-- ### Tag which portfolios to exclude from the investments in the hierarchy
	HIE_VALID_PARENTS_PT2 AS (
		SELECT
		  hwpt.HIERARCHY_EXTERNAL_ID
		  , hwpt.HIERARCHY_NAME
		  , hwpt.HIE_INV_TYPE_NAME
		  , hwpt.HIE_INV_EXTERNAL_ID
		  , hwpt.HIE_INV_NAME
		  , hwpt.HIE_INV_HIERARCHY_LEVEL
		  , hvp1_a.HIE_INV_PARENT_NAME
		  , hvp1_a.HIE_INV_PARENT_EXT_ID
		  , hvp1_a.HIE_INV_PARENT_TYPE
		  , hvp1_b.EXCLUDE_PORTFOLIO
		FROM HIE_W_PAR_TYPE hwpt
		LEFT JOIN HIE_VALID_PARENTS_PT1 hvp1_a
		  ON ( hwpt.HIERARCHY_EXTERNAL_ID = hvp1_a.HIERARCHY_EXTERNAL_ID ) AND ( hwpt.HIE_INV_PARENT_EXT_ID = hvp1_a.HIE_INV_PARENT_EXT_ID ) AND ( 'Y' <> hvp1_a.EXCLUDE_PORTFOLIO )
		LEFT JOIN HIE_VALID_PARENTS_PT1 hvp1_b
		  ON ( hwpt.HIERARCHY_EXTERNAL_ID = hvp1_b.HIERARCHY_EXTERNAL_ID ) AND ( hwpt.HIE_INV_EXTERNAL_ID = hvp1_b.HIE_INV_PARENT_EXT_ID )
	),

	-- ### Exclude any portfolios tagged for exclusion
	HIE_VALID_PARENTS_PT3 AS (
		SELECT
		  HIERARCHY_EXTERNAL_ID
		  , HIERARCHY_NAME
		  , HIE_INV_TYPE_NAME
		  , HIE_INV_EXTERNAL_ID
		  , HIE_INV_NAME
		  , HIE_INV_HIERARCHY_LEVEL
		  , HIE_INV_PARENT_NAME
		  , HIE_INV_PARENT_EXT_ID
		  , HIE_INV_PARENT_TYPE
		FROM HIE_VALID_PARENTS_PT2
		WHERE ( EXCLUDE_PORTFOLIO <> 'Y' ) OR ( EXCLUDE_PORTFOLIO IS NULL )
	),

	-- ### Duplicate all programs and make themselves their own parents since they should each have a roadmap which shows themselves + children
	HIE_VALID_PARENTS_PT4 AS (
		( SELECT
		  HIERARCHY_EXTERNAL_ID
		  , HIERARCHY_NAME
		  , HIE_INV_TYPE_NAME
		  , HIE_INV_EXTERNAL_ID
		  , HIE_INV_NAME
		  , HIE_INV_HIERARCHY_LEVEL
		  , HIE_INV_NAME AS HIE_INV_PARENT_NAME
		  , HIE_INV_EXTERNAL_ID AS HIE_INV_PARENT_EXT_ID
		  , HIE_INV_TYPE_NAME AS HIE_INV_PARENT_TYPE
		FROM HIE_VALID_PARENTS_PT3
		WHERE HIE_INV_TYPE_NAME = 'Programs' )
		UNION
		( SELECT
		    *
		  FROM HIE_VALID_PARENTS_PT3 
		  WHERE HIE_INV_PARENT_EXT_ID IS NOT NULL )
	),

	-- ### Determine COE investment type: Portfolio, Program, Sub-Program, Project
	-- ### Pt1: Count attributes to enable logic to be applied later
	HIE_COE_INV_TYPE_PT1 AS (
		SELECT
		  HIERARCHY_EXTERNAL_ID
		  , HIE_INV_PARENT_NAME
		  , HIE_INV_PARENT_EXT_ID
		  , HIE_INV_PARENT_TYPE
		  , CASE WHEN HIE_INV_PARENT_TYPE = 'Portfolios' THEN 1 END AS IS_PORTFOLIO
		  , SUM( CASE WHEN ( HIE_INV_TYPE_NAME = 'Programs' ) AND ( HIE_INV_PARENT_EXT_ID <> HIE_INV_EXTERNAL_ID ) THEN 1 END ) AS NBR_CHILD_PROGRAMS
		  , COUNT(1) AS NBR_CHILDREN
		FROM HIE_VALID_PARENTS_PT4
		GROUP BY HIERARCHY_EXTERNAL_ID, HIE_INV_PARENT_NAME, HIE_INV_PARENT_EXT_ID, HIE_INV_PARENT_TYPE
	),

	-- ### Determine COE investment type: Portfolio, Program, Sub-Program, Project
	-- ### Part 2: Determine COE type of parents
	HIE_COE_INV_TYPE_PT2 AS (
		SELECT
		  HIERARCHY_EXTERNAL_ID
		  , HIE_INV_PARENT_NAME
		  , HIE_INV_PARENT_EXT_ID
		  , HIE_INV_PARENT_TYPE AS HIE_INV_PAR_CLRTY_TYPE
		  , CASE
		  	  WHEN HIE_INV_PARENT_EXT_ID IS NULL THEN NULL
		      WHEN IS_PORTFOLIO > 0 THEN 'Portfolio'
		      WHEN NBR_CHILD_PROGRAMS > 0 THEN 'Program'
		      ELSE 'Sub-Program'
		    END AS HIE_INV_PAR_COE_ROADMAP_TYPE
		FROM HIE_COE_INV_TYPE_PT1
	),

	-- ### Join COE roadmap investment type to hierarchy items, and tag if an investment is an owner of a roadmap (ie. To be shown at the top of it)
	HIE_VALID_PARENTS_PT5 AS (
		SELECT
		  hvp4.HIERARCHY_EXTERNAL_ID
		  , hvp4.HIERARCHY_NAME
		  , hcit2.HIE_INV_PAR_COE_ROADMAP_TYPE AS COE_ROADMAP_TYPE
		  , hvp4.HIE_INV_PARENT_EXT_ID AS COE_ROADMAP_PARENT_ID
		  , hvp4.HIE_INV_PARENT_NAME AS COE_ROADMAP_PARENT_NAME
		  , hvp4.HIE_INV_PARENT_TYPE AS COE_ROADMAP_PARENT_CLRTY_TYPE
		  , hvp4.HIE_INV_EXTERNAL_ID AS CHILD_ID
		  , hvp4.HIE_INV_NAME AS CHILD_NAME
		  , hvp4.HIE_INV_TYPE_NAME AS CLRTY_CHILD_TYPE
		  , CASE WHEN ( ( hvp4.HIE_INV_PARENT_EXT_ID = hvp4.HIE_INV_EXTERNAL_ID ) AND ( hvp4.HIE_INV_PARENT_TYPE = 'Programs' ) ) THEN 1 END AS ROADMAP_OWNER
		FROM HIE_VALID_PARENTS_PT4 hvp4
		LEFT JOIN HIE_COE_INV_TYPE_PT2 hcit2
		  ON hvp4.HIE_INV_PARENT_EXT_ID = hcit2.HIE_INV_PARENT_EXT_ID
	),

	-- ### Identify investments not managed in Clarity, but tagged within Programs [Parent name like 'Deployments', tagged as 'BusinessGoLive']
	-- NOTE: Any logic change here also needs to occur in the Hierarchy-Roadmap query
	NON_CLRTY_DEPLOYMENTS_PT1 AS (
		SELECT 
	      PROJECT_INTERNAL_ID AS INV_INT_ID
		  , PROJECT_ID AS INV_EXT_ID
		  , INVESTMENT_NAME
		  , TASKEXTID
		  , TASK_NAME			
		  ,	TO_DATE( TASK_START_DATE ) AS TASK_START
		  , TO_DATE( TASK_FINISH_DATE ) AS TASK_FINISH
		  , TASK_STATUS
		  , TASK_STATE
		  , IS_KEYTASK
		  , IS_MILESTONE
		  , GUIDELINES AS TIER
		  , CATEGORY AS FUNCTION
		  , PRUSERTEXT1 AS MARKET
		  , SUBSTRING( TRIM( TASK_NAME ),
		  			   1,
		  			   LEN( TRIM( TASK_NAME ) ) - CHARINDEX( ' ', REVERSE( TRIM( TASK_NAME ) ) )
		  			 ) AS NEW_STRING -- Removes last word from TASK_NAME and so identifies non-Clarity investment name
	    FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_task_v
    	WHERE PROJECT_ID LIKE 'PROG%' -- Programs only
          AND UPPER( TASK_NAME ) NOT LIKE '%IGNORE%'
          AND UPPER( PARENT_NAME ) NOT LIKE '%IGNORE%'
          and UPPER( PARENT_NAME ) LIKE '%DEPLOYMENTS%'
          AND ISGOLIVETASK = 'Yes'
	),

	-- ### For non-clarity deployments:
	-- ###	- grant them a unique ID,
	-- ### 	- check that the data is correct (2 rows per deployment, of which 1 a milestone)
	-- ###  - identify the investment status (based on that for the non-milestone row)
	-- ### NOTE: Any logic change here also needs to occur in the Hierarchy-Roadmap query
	NON_CLRTY_DEPLOYMENTS_PT2 AS (
		SELECT
		  INV_INT_ID
		  , INVESTMENT_NAME
		  , NEW_STRING
		  , SUM( CASE WHEN IS_MILESTONE = 'Yes' THEN 1 END ) AS NBR_MSTONES
		  , COUNT(1) AS NBR_ROWS
		  , CASE WHEN ( NBR_MSTONES = 1 ) AND ( NBR_ROWS = 2 ) THEN 1 END AS CHECK_PASSED
		  , CAST( TO_CHAR( INV_INT_ID, '0000000' )
		    	    || 
		       	    TO_CHAR( ( RANK() OVER ( PARTITION BY INV_INT_ID ORDER BY NEW_STRING ASC ) ), '000' )
		       	  AS NUMERIC ) AS DUMMY_ID
		  , MAX( CASE WHEN IS_MILESTONE = 'No' THEN TASK_STATE END ) AS TASK_STATE
		FROM NON_CLRTY_DEPLOYMENTS_PT1
		GROUP BY INV_INT_ID, INVESTMENT_NAME, NEW_STRING
	),

	-- ### For non-clarity deployments:
	-- ###   - inner join the new ID and overall status where the correct data is inputted,
	-- ###   - define each roadmap element
	-- ### NOTE: Any logic change here also needs to occur in the Hierarchy-Roadmap query
	NON_CLRTY_DEPLOYMENTS_PT3 AS (
		SELECT
		  ncd2.DUMMY_ID AS INV_INT_ID
		  , ( 'FAKE' || TO_CHAR( ncd2.DUMMY_ID, '0000000000' ) ) AS INV_EXT_ID
		  , ncd2.NEW_STRING AS INVESTMENT_NAME
		  , CASE
		      WHEN ncd1.IS_MILESTONE = 'Yes' THEN 'Milestones - Deployment'
		      ELSE 'Investment'
		    END AS ROADMAP_ELEMENT
		  , NULL AS TASKEXTID
		  , CASE
		      WHEN ncd1.IS_MILESTONE = 'Yes' THEN 'SG3'
		      ELSE 'Start/Finish Dates'
		    END AS TASK_NAME
		  , ncd1.TASK_START
		  , ncd1.TASK_FINISH
		  , CASE
		      WHEN ( UPPER( ncd1.TASK_STATUS ) = 'COMPLETED' ) AND ( ncd1.IS_MILESTONE = 'Yes' ) THEN "Completed"
		      WHEN ( UPPER( ncd1.TASK_STATUS ) <> 'COMPLETED' ) AND ( ncd1.IS_MILESTONE = 'Yes' ) THEN "Incomplete"
		      ELSE NULL
		    END AS MILESTONE_STATUS
		  , COALESCE( ncd2.TASK_STATE, 'Grey' ) AS INITIATIVE_STATUS
		  , ncd1.INV_INT_ID AS PARENT_INT_ID
		  , ncd1.INV_EXT_ID AS PARENT_EXT_ID
		  , ncd1.INVESTMENT_NAME AS PARENT_NAME
		  , ncd1.TIER
		  , ncd1.FUNCTION
		  , ncd1.MARKET
		  , "Non-Clarity item" AS INV_TYPE
		FROM NON_CLRTY_DEPLOYMENTS_PT1 ncd1
		INNER JOIN NON_CLRTY_DEPLOYMENTS_PT2 ncd2
		  ON ( ncd1.INV_INT_ID = ncd2.INV_INT_ID )
		  AND ( ncd1.NEW_STRING = ncd2.NEW_STRING )
		  AND ( 1 = ncd2.CHECK_PASSED )		
	),
	
	-- ### For non-clarity deployments, filter and remove cols to enable unioning/joining to hierarchy data
	NON_CLRTY_DEPLOYMENTS_PT4 AS (
		SELECT
		  PARENT_EXT_ID AS COE_ROADMAP_PARENT_ID
		  , PARENT_NAME AS COE_ROADMAP_PARENT_NAME
		  , INV_EXT_ID AS CHILD_ID
		  , INVESTMENT_NAME AS CHILD_NAME
		  , INV_TYPE AS CLRTY_CHILD_TYPE
		  , NULL AS ROADMAP_OWNER
		FROM NON_CLRTY_DEPLOYMENTS_PT3
		WHERE ROADMAP_ELEMENT = 'Investment'
	),

	-- ### For non-clarity deployments, append hierarchical data based on parent ID
	-- ### Note that hierarchy values are NULL if parent isn't in a hierarchy
	NON_CLRTY_DEPLOYMENTS_PT5 AS (
		SELECT
		  distinct_hvp5.HIERARCHY_EXTERNAL_ID
		  , distinct_hvp5.HIERARCHY_NAME
		  , distinct_hvp5.COE_ROADMAP_TYPE
		  , ncd4.COE_ROADMAP_PARENT_ID
		  , ncd4.COE_ROADMAP_PARENT_NAME
		  , distinct_hvp5.COE_ROADMAP_PARENT_CLRTY_TYPE
		  , ncd4.CHILD_ID
		  , ncd4.CHILD_NAME
		  , ncd4.CLRTY_CHILD_TYPE
		  , ncd4.ROADMAP_OWNER
		FROM NON_CLRTY_DEPLOYMENTS_PT4 ncd4
		LEFT JOIN (
			SELECT DISTINCT
			  HIERARCHY_EXTERNAL_ID
			  , HIERARCHY_NAME
			  , COE_ROADMAP_TYPE
			  , COE_ROADMAP_PARENT_ID
			  , COE_ROADMAP_PARENT_NAME
			  , COE_ROADMAP_PARENT_CLRTY_TYPE
			FROM HIE_VALID_PARENTS_PT5
		) distinct_hvp5
		  ON ncd4.COE_ROADMAP_PARENT_ID = distinct_hvp5.COE_ROADMAP_PARENT_ID
	),

	-- ### Union both official hierarchy items plus non-clarity deployment items
	HIE_VALID_PARENTS_PT6 AS (
		( SELECT * FROM HIE_VALID_PARENTS_PT5 )
		UNION
		( SELECT * FROM NON_CLRTY_DEPLOYMENTS_PT5 WHERE HIERARCHY_EXTERNAL_ID IS NOT NULL )
		ORDER BY COE_ROADMAP_TYPE, COE_ROADMAP_PARENT_NAME, ROADMAP_OWNER DESC, CHILD_NAME
	)


	
-- ### Resulting query [NOTE: It is currently just for one hierarchy]
SELECT * FROM HIE_VALID_PARENTS_PT6
