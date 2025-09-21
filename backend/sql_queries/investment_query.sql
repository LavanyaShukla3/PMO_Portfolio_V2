

WITH
	-- ### Identify the start/finish dates of each project & program based on its tasks
	INV_START_FIN AS (
		SELECT 
	      PROJECT_INTERNAL_ID AS INV_INT_ID
		  , PROJECT_ID AS INV_EXT_ID
		  , INVESTMENT_NAME
		  , "Investment" AS ROADMAP_ELEMENT
		  , NULL AS TASKEXTID
		  , "Start/Finish Dates" AS TASK_NAME
		  ,	TO_DATE( MIN( TASK_START_DATE ) ) AS TASK_START
		  , TO_DATE( MAX( TASK_FINISH_DATE ) ) AS TASK_FINISH
		  , NULL AS MILESTONE_STATUS
	    FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_task_v
    	WHERE ( ( PROJECT_ID LIKE 'PR0000%' ) OR ( PROJECT_ID LIKE 'PROG%' ) ) -- Projects and Programs only
          AND UPPER( TASK_NAME ) NOT LIKE '%IGNORE%'
          AND ( ( UPPER( PARENT_NAME ) NOT LIKE '%IGNORE%' ) OR ( PARENT_NAME IS NULL ) )
        GROUP BY PROJECT_INTERNAL_ID, PROJECT_ID, INVESTMENT_NAME
	),

	-- ### For the top level of each project and program's WBS, assign the appropriate lifecycle phase and its start/finish date
	INV_PHASES_PT1 AS (
		SELECT 
	      PROJECT_INTERNAL_ID AS INV_INT_ID
		  , PROJECT_ID AS INV_EXT_ID
		  , INVESTMENT_NAME
		  , "Phases" AS ROADMAP_ELEMENT
		  , TASKEXTID
		  -- , TASK_NAME AS ORIG_TASK_NAME -- Deliberately hidden but useful for error checking
		  , CASE
		  	  WHEN UPPER( TASK_NAME ) LIKE '%INITIATE%' THEN "Initiate"
		  	  WHEN UPPER( TASK_NAME ) LIKE '%EVALUATE%' THEN "Evaluate"
		  	  WHEN UPPER( TASK_NAME ) LIKE '%DEVELOP%' THEN "Develop"
		  	  WHEN UPPER( TASK_NAME ) LIKE '%DEPLOY%' THEN "Deploy"
		  	  WHEN UPPER( TASK_NAME ) LIKE '%SUSTAIN%' THEN "Sustain"
			  WHEN UPPER( TASK_NAME ) LIKE '%CLOSE%' THEN "Close"
			  WHEN ( INVESTMENT_NAME LIKE '%IBP%' ) AND ( UPPER( TASK_NAME ) LIKE '%MOBILIZATION%' ) THEN "Initiate"  
			  WHEN ( INVESTMENT_NAME LIKE '%IBP%' ) AND ( UPPER( TASK_NAME ) LIKE '%SOLUTION DESIGN%' ) THEN "Evaluate"  
			  WHEN ( INVESTMENT_NAME LIKE '%IBP%' ) AND ( UPPER( TASK_NAME ) LIKE '%IMPLEMENTATION%' ) THEN "Develop"  
			  WHEN ( INVESTMENT_NAME LIKE '%IBP%' ) AND ( UPPER( TASK_NAME ) LIKE '%HYPERCARE%' ) THEN "Deploy"  
			  WHEN ( INVESTMENT_NAME LIKE '%IBP%' ) AND ( UPPER( TASK_NAME ) LIKE '%HYPER-CARE%' ) THEN "Deploy"  
			  ELSE "Unphased"
			END AS TASK_NAME			
		  ,	TO_DATE( TASK_START_DATE ) AS TASK_START
		  , TO_DATE( TASK_FINISH_DATE ) AS TASK_FINISH
		  , NULL AS MILESTONE_STATUS
	    FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_task_v
    	WHERE ( ( PROJECT_ID LIKE 'PR0000%' ) OR ( PROJECT_ID LIKE 'PROG%' ) ) -- Projects and Programs only
          AND UPPER( TASK_NAME ) NOT LIKE '%IGNORE%'
          AND PARENT_NAME IS NULL
	),

	-- ### For each investment determine if the phases are in the correct order (based on the phase order and start/finish dates), and mark phase as 'Unphased' if not
	INV_PHASES_PT2 AS (
		SELECT
		  INV_INT_ID
		  , INV_EXT_ID
		  , INVESTMENT_NAME
		  , ROADMAP_ELEMENT
		  , TASKEXTID
		  , RANK() OVER ( PARTITION BY INV_INT_ID ORDER BY TASK_START ASC ) AS START_RANK
		  , RANK() OVER ( PARTITION BY INV_INT_ID ORDER BY TASK_FINISH ASC ) AS FINISH_RANK
		  , CASE
		  	  WHEN TASK_NAME = "Initiate" THEN 1
		  	  WHEN TASK_NAME = "Evaluate" THEN 2
		  	  WHEN TASK_NAME = "Develop" THEN 3
		  	  WHEN TASK_NAME = "Deploy" THEN 4
		  	  WHEN TASK_NAME = "Sustain" THEN 5
		  	  WHEN TASK_NAME = "Close" THEN 6
			END AS PHASE_RANK
		  , CASE
		  	  WHEN ( START_RANK = FINISH_RANK ) AND ( START_RANK = PHASE_RANK ) THEN TASK_NAME
		  	  ELSE "Unphased"
		  	END AS TASK_NAME
		  , TASK_START
		  , TASK_FINISH
		  , MILESTONE_STATUS
		FROM INV_PHASES_PT1
	),

	-- ### For each investment check if any phase is marked as 'Unphased'
	INV_PHASES_PT3 AS (
		SELECT
		  INV_INT_ID
		  , INVESTMENT_NAME
		  , MAX( CASE WHEN TASK_NAME = 'Unphased' THEN 1 ELSE 0 END ) AS UNPHASED
		FROM INV_PHASES_PT2
		GROUP BY INV_INT_ID, INVESTMENT_NAME
	),

	-- ### Get list of unphased investments
	INV_PHASES_PT4_UNPHASED AS (
		SELECT
		  INV_INT_ID
		  , INVESTMENT_NAME
		FROM INV_PHASES_PT3
		WHERE UNPHASED = 1
	),

	-- ### Get list of phased investments, then adjust the start date of phases such that it's the day after the prior phase finishes
	INV_PHASES_PT4_PHASED AS (
		SELECT
		  ph2.INV_INT_ID
		  , ph2.INV_EXT_ID
		  , ph2.INVESTMENT_NAME
		  , ph2.ROADMAP_ELEMENT
		  , ph2.TASKEXTID
		  , ph2.TASK_NAME
		  , ph2.TASK_START AS TASK_START_ORIGINAL
		  , ph2.TASK_FINISH
		  , ph2.MILESTONE_STATUS
		  , ph2.PHASE_RANK
		  , TO_DATE( COALESCE( DATEADD( DAY,
		      							1,
		      							LAG( ph2.TASK_FINISH ) OVER ( PARTITION BY ph2.INV_INT_ID ORDER BY ph2.PHASE_RANK ASC ) ),
		      				   ph2.TASK_START ) )
		    AS TASK_START -- // Adjusted task start date
		FROM INV_PHASES_PT2 ph2
		INNER JOIN INV_PHASES_PT3 ph3
		  ON ( ph2.INV_INT_ID = ph3.INV_INT_ID ) AND ( 0 = ph3.UNPHASED )
	),

	-- ### Union each phase of phased investments with a single row for each unphased investments, ensuring that each unphased investment is tagged as such
	INV_PHASES_PT5 AS (
		( SELECT
	      INV_INT_ID
		  , INV_EXT_ID
		  , INVESTMENT_NAME
		  , ROADMAP_ELEMENT
		  , TASKEXTID
		  , TASK_NAME			
		  ,	TASK_START
		  , TASK_FINISH
		  , MILESTONE_STATUS
		FROM INV_PHASES_PT4_PHASED
		)
		UNION
		( SELECT 
	      isf.INV_INT_ID
		  , isf.INV_EXT_ID
		  , isf.INVESTMENT_NAME
		  , "Phases" AS ROADMAP_ELEMENT
		  , isf.INV_EXT_ID AS TASKEXTID
		  , "Unphased" AS TASK_NAME
		  ,	isf.TASK_START
		  , isf.TASK_FINISH
		  , isf.MILESTONE_STATUS
		FROM INV_START_FIN isf
		INNER JOIN INV_PHASES_PT4_UNPHASED pt4Un
		  ON isf.INV_INT_ID = pt4Un.INV_INT_ID
		)	  
	), 

	-- ### Get list of PROJECT key milestones, and categorise them as either 'Deployments' or 'Other' milestones
	-- ###   - Exclude non-SG3 stage gate milestones since projects will have their phases visible
	PROJ_MSTONES AS (
		SELECT 
	      PROJECT_INTERNAL_ID AS INV_INT_ID
		  , PROJECT_ID AS INV_EXT_ID
		  , INVESTMENT_NAME
		  , CASE
		  	  -- WHEN UPPER( TASK_NAME ) = 'SG3 - DEVELOP STAGE COMPLETE' THEN "Milestones - Deployment"
		  	  WHEN UPPER( TASK_NAME ) LIKE '%SG3%' THEN "Milestones - Deployment"
			  ELSE "Milestones - Other"
		    END AS ROADMAP_ELEMENT
		  , TASKEXTID
		  , TASK_NAME			
		  ,	TO_DATE( TASK_START_DATE ) AS TASK_START
		  , TO_DATE( TASK_FINISH_DATE ) AS TASK_FINISH
		  , CASE
		      WHEN UPPER( TASK_STATUS ) = 'COMPLETED' THEN "Completed"
		      ELSE "Incomplete"
		    END AS MILESTONE_STATUS
	    FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_task_v
    	WHERE PROJECT_ID LIKE 'PR0000%' -- Projects only
          AND UPPER( TASK_NAME ) NOT LIKE '%IGNORE%'
          AND UPPER( PARENT_NAME ) NOT LIKE '%IGNORE%'
          AND IS_KEYTASK = 'Yes'
          AND IS_MILESTONE = 'Yes'
	),

	-- ### Get list of PROGRAM key milestones, and categorise them as either 'Deployments' or 'Other' milestones
	PROG_MSTONES AS (
		SELECT 
	      PROJECT_INTERNAL_ID AS INV_INT_ID
		  , PROJECT_ID AS INV_EXT_ID
		  , INVESTMENT_NAME
		  , CASE
		  	  WHEN UPPER( PARENT_NAME ) LIKE '%DEPLOYMENTS%' THEN "Milestones - Deployment"
			  ELSE "Milestones - Other"
		    END AS ROADMAP_ELEMENT
		  , TASKEXTID
		  , TASK_NAME			
		  ,	TO_DATE( TASK_START_DATE ) AS TASK_START
		  , TO_DATE( TASK_FINISH_DATE ) AS TASK_FINISH
		  , CASE
		      WHEN UPPER( TASK_STATUS ) = 'COMPLETED' THEN "Completed"
		      ELSE "Incomplete"
		    END AS MILESTONE_STATUS
	    FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_task_v
    	WHERE PROJECT_ID LIKE 'PROG%' -- Programs only
          AND UPPER( TASK_NAME ) NOT LIKE '%IGNORE%'
          AND UPPER( PARENT_NAME ) NOT LIKE '%IGNORE%'
          AND IS_KEYTASK = 'Yes'
          AND IS_MILESTONE = 'Yes'
	),

	CLRTY_ROADMAP_ITEMS AS (
	-- ### Union all roadmap element data (start/finish dates, phases, milestones)
	-- ### 9cols: INV_INT_ID, INV_EXT_ID, INVESTMENT_NAME, ROADMAP_ELEMENT, TASKEXTID, TASK_NAME, TASK_START, TASK_FINISH, MILESTONE_STATUS 
		SELECT * FROM INV_START_FIN
		UNION
		SELECT * FROM INV_PHASES_PT5
		UNION
		SELECT * FROM PROJ_MSTONES
		UNION
		SELECT * FROM PROG_MSTONES
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

	-- ### This is a hard-coded lookup table to align manual inputs of Tier/Function/Market for non-clarity managed investments with official Clarity values
	-- ### NOTE: This table is likely to evolve over time
	DEPLOYMENT_PARAMS AS (
		SELECT 
      	  Field
      	  , Input
      	  , Output
		FROM (
			VALUES
				-- ### Values from re-purposed field in Tasks tab for Tier
        		( "Tier", 		"Tier: 1", 								"1")
		        , ( "Tier", 	"Tier: 2", 								"2")
		        , ( "Tier", 	"Tier: 3", 								"3")
		        -- ### Values from Clarity Tier field
		        , ( "Tier", 	"Tier 1", 								"1")
		        , ( "Tier", 	"Tier 2", 								"2")
		        , ( "Tier", 	"Tier 3", 								"3")
				-- ### Values from re-purposed field in Tasks tab for Function
		        , ( "Function",	"Function: Commercial", 				"Commercial")
		        , ( "Function",	"Function: Commercialization", 			"Commercialization")
		        , ( "Function",	"Function: Consumer", 					"Consumer")
		        , ( "Function",	"Function: Controls", 					"Controls")
		        , ( "Function",	"Function: Corp Affairs", 				"Corporate Affairs")
		        , ( "Function",	"Function: eComm", 						"eCommerce")
		        , ( "Function",	"Function: EHS", 						"EHS")
		        , ( "Function",	"Function: Enterprise", 				"Enterprise")
		        , ( "Function",	"Function: Facilities", 				"Facilities")
		        , ( "Function",	"Function: Finance", 					"Finance")
		        , ( "Function",	"Function: Franchise", 					"Franchise")
		        , ( "Function",	"Function: HR", 						"HR")
		        , ( "Function",	"Function: Legal", 						"Legal")
		        , ( "Function",	"Function: Procurement", 				"Procurement")
		        , ( "Function",	"Function: R&D", 						"R&D")
		        , ( "Function",	"Function: S&T", 						"S&T")
		        , ( "Function",	"Function: Sodastream", 				"Sodastream")
		        , ( "Function",	"Function: Supply Chain", 				"Supply Chain")
		        , ( "Function",	"Function: Sustainability", 			"Sustainability")
		        , ( "Function",	"Function: TBD", 						"TBD")
				-- ### Values from Clarity Business Function field
				, ( "Function", "Commercial - Sales & Go to Market",	"Commercial")
				, ( "Function", "Revenue Management",     				"Commercial")
				, ( "Function", "Commercialization",     				"Commercialization")
				, ( "Function", "Consumer & Marketing",     			"Consumer")
				, ( "Function", "Demand Accelerator (DX)",     			"Consumer")
				, ( "Function", "Control & Reporting",     				"Controls")
				, ( "Function", "Corporate Affairs & Communications",	"Corporate Affairs")
				, ( "Function", "eCommerce",     						"eCommerce")
				, ( "Function", "Environment Health & Safety",     		"EHS")
				, ( "Function", "Enterprise Integration",     			"Enterprise")
				, ( "Function", "Facilities-Real Estate",     			"Facilities")
				, ( "Function", "Financial Planning & Operations",		"Finance")
				, ( "Function", "Tax Audit & Treasury",     			"Finance")
				, ( "Function", "Franchise",     						"Franchise")
				, ( "Function", "Human Resources",     					"HR")
				, ( "Function", "Legal",     							"Legal")
				, ( "Function", "Procurement",     						"Procurement")
				, ( "Function", "Research and Development",     		"R&D")
				, ( "Function", "Data & Analytics",     				"S&T")
				, ( "Function", "Global Business Services",     		"S&T")
				, ( "Function", "Information Technology",     			"S&T")
				, ( "Function", "Intelligent Automation & AI",     		"S&T")
				, ( "Function", "Internet of Things",     				"S&T")
				, ( "Function", "Strategy and Transformation",     		"S&T")
				, ( "Function", "Web Solutions",     					"S&T")
				, ( "Function", "Beyond the Bottle - SodaStream",		"Sodastream")
				, ( "Function", "Manufacturing",     					"Supply Chain")
				, ( "Function", "Supply Chain Operations",     			"Supply Chain")
				, ( "Function", "Sustainability",     					"Sustainability")
				, ( "Function", "TBD",     								"TBD")
				-- ### Values from re-purposed field in Tasks tab for Market
				, ( "Market",    "Market: APAC",     					"APAC")
				, ( "Market",    "Market: APAC/ANZ",     				"APAC/ANZ")
				, ( "Market",    "Market: APAC/Australia",     			"APAC/Australia")
				, ( "Market",    "Market: APAC/China",     				"APAC/China")
				, ( "Market",    "Market: APAC/Indochina",     			"APAC/Indochina")
				, ( "Market",    "Market: APAC/Indonesia",     			"APAC/Indonesia")
				, ( "Market",    "Market: APAC/Malaysia",     			"APAC/Malaysia")
				, ( "Market",    "Market: APAC/Myanmar",     			"APAC/Myanmar")
				, ( "Market",    "Market: APAC/New Zealand",    		"APAC/New Zealand")
				, ( "Market",    "Market: APAC/Philippines",     		"APAC/Philippines")
				, ( "Market",    "Market: APAC/Taiwan",     			"APAC/Taiwan")
				, ( "Market",    "Market: APAC/Thailand",     			"APAC/Thailand")
				, ( "Market",    "Market: APAC/Vietnam",     			"APAC/Vietnam")
				, ( "Market",    "Market: EMEA",     					"EMEA")
				, ( "Market",    "Market: EMEA/Baltics",     			"EMEA/Baltics")
				, ( "Market",    "Market: EMEA/Belgium",     			"EMEA/Belgium")
				, ( "Market",    "Market: EMEA/BUCCA",     				"EMEA/BUCCA")
				, ( "Market",    "Market: EMEA/Cyprus",     			"EMEA/Cyprus")
				, ( "Market",    "Market: EMEA/DACH",     				"EMEA/DACH")
				, ( "Market",    "Market: EMEA/Egypt",     				"EMEA/Egypt")
				, ( "Market",    "Market: EMEA/France",     			"EMEA/France")
				, ( "Market",    "Market: EMEA/Germany",     			"EMEA/Germany")
				, ( "Market",    "Market: EMEA/Greece",     			"EMEA/Greece")
				, ( "Market",    "Market: EMEA/Iberia",     			"EMEA/Iberia")
				, ( "Market",    "Market: EMEA/India",     				"EMEA/India")
				, ( "Market",    "Market: EMEA/Ireland",     			"EMEA/Ireland")
				, ( "Market",    "Market: EMEA/Italy",     				"EMEA/Italy")
				, ( "Market",    "Market: EMEA/Netherlands",     		"EMEA/Netherlands")
				, ( "Market",    "Market: EMEA/Nordics",     			"EMEA/Nordics")
				, ( "Market",    "Market: EMEA/NWE",     				"EMEA/NWE")
				, ( "Market",    "Market: EMEA/Pakistan",     			"EMEA/Pakistan")
				, ( "Market",    "Market: EMEA/Poland",     			"EMEA/Poland")
				, ( "Market",    "Market: EMEA/Romania",     			"EMEA/Romania")
				, ( "Market",    "Market: EMEA/Russia",     			"EMEA/Russia")
				, ( "Market",    "Market: EMEA/Saudi Arabia",     		"EMEA/Saudi Arabia")
				, ( "Market",    "Market: EMEA/Serbia",     			"EMEA/Serbia")
				, ( "Market",    "Market: EMEA/South Africa",     		"EMEA/South Africa")
				, ( "Market",    "Market: EMEA/Spain",     				"EMEA/Spain")
				, ( "Market",    "Market: EMEA/SSA",     				"EMEA/SSA")
				, ( "Market",    "Market: EMEA/SWE",     				"EMEA/SWE")
				, ( "Market",    "Market: EMEA/Turkey",     			"EMEA/Turkey")
				, ( "Market",    "Market: EMEA/UK",     				"EMEA/UK")
				, ( "Market",    "Market: EMEA/UKI",     				"EMEA/UKI")
				, ( "Market",    "Market: EMEA/Ukraine",     			"EMEA/Ukraine")
				, ( "Market",    "Market: EMEA/WEST",     				"EMEA/WEST")
				, ( "Market",    "Market: Global",     					"Global")
				, ( "Market",    "Market: LATAM",     					"LATAM")
				, ( "Market",    "Market: LATAM/Andean",     			"LATAM/Andean")
				, ( "Market",    "Market: LATAM/Argentina",     		"LATAM/Argentina")
				, ( "Market",    "Market: LATAM/Brazil",     			"LATAM/Brazil")
				, ( "Market",    "Market: LATAM/CariCam",     			"LATAM/CariCam")
				, ( "Market",    "Market: LATAM/Chile",     			"LATAM/Chile")
				, ( "Market",    "Market: LATAM/Colombia",     			"LATAM/Colombia")
				, ( "Market",    "Market: LATAM/Costa Rica",     		"LATAM/Costa Rica")
				, ( "Market",    "Market: LATAM/Dominican Republic",    "LATAM/Dominican Republic")
				, ( "Market",    "Market: LATAM/Ecuador",     			"LATAM/Ecuador")
				, ( "Market",    "Market: LATAM/El Salvador",     		"LATAM/El Salvador")
				, ( "Market",    "Market: LATAM/Guatemala",     		"LATAM/Guatemala")
				, ( "Market",    "Market: LATAM/Honduras",     			"LATAM/Honduras")
				, ( "Market",    "Market: LATAM/Mexico",     			"LATAM/Mexico")
				, ( "Market",    "Market: LATAM/Panama",     			"LATAM/Panama")
				, ( "Market",    "Market: LATAM/Peru",     				"LATAM/Peru")
				, ( "Market",    "Market: LATAM/Puerto Rico",     		"LATAM/Puerto Rico")
				, ( "Market",    "Market: LATAM/SOCO",     				"LATAM/SOCO")
				, ( "Market",    "Market: LATAM/Uruguay",     			"LATAM/Uruguay")
				, ( "Market",    "Market: LATAM/Venezuela",     		"LATAM/Venezuela")
				, ( "Market",    "Market: NA/Bevs",     				"NA/Bevs")
				, ( "Market",    "Market: NA/Canada Bevs",     			"NA/Canada Bevs")
				, ( "Market",    "Market: NA/Canada Foods",     		"NA/Canada Foods")
				, ( "Market",    "Market: NA/Foods",     				"NA/Foods")
				, ( "Market",    "Market: NA/Gatorade",     			"NA/Gatorade")
				, ( "Market",    "Market: NA/Quaker",     				"NA/Quaker")
				, ( "Market",    "Market: NA/Tropicana",     			"NA/Tropicana")
				, ( "Market",    "Market: NA/US Bevs",     				"NA/US Bevs")
				, ( "Market",    "Market: NA/US Foods",     			"NA/US Foods")
				, ( "Market",    "Market: PGCS",     					"PGCS")
				, ( "Market",    "Market: SodaStream",     				"SodaStream")
				-- ### Values from Clarity extract Impacted_Market_Units field 
				, ( "Market",    "APAC",     							"APAC")
				, ( "Market",    "APAC HQ",     						"APAC")
				, ( "Market",    "ASIABEVGMD",     						"APAC")
				, ( "Market",    "ANZ",     							"APAC/ANZ")
				, ( "Market",    "Australia",    						"APAC/Australia")
				, ( "Market",    "China",     							"APAC/China")
				, ( "Market",    "China Bev Hongkong",     				"APAC/China")
				, ( "Market",    "China Beverages - SH & Beijing",     	"APAC/China")
				, ( "Market",    "China Shanghai Snacks",     			"APAC/China")
				, ( "Market",    "IndochinaFoods",     					"APAC/Indochina")
				, ( "Market",    "IndonesiaFoods",     					"APAC/Indonesia")
				, ( "Market",    "MalaysiaFoods",     					"APAC/Malaysia")
				, ( "Market",    "MyanmarBev",     						"APAC/Myanmar")
				, ( "Market",    "New Zealand",     					"APAC/New Zealand")
				, ( "Market",    "PhilippinesBev",     					"APAC/Philippines")
				, ( "Market",    "PhilippinesFoods",    		 		"APAC/Philippines")
				, ( "Market",    "Taiwan GC Snacks",     				"APAC/Taiwan")
				, ( "Market",    "Thailand Bev",     					"APAC/Thailand")
				, ( "Market",    "Thailand Foods",     					"APAC/Thailand")
				, ( "Market",    "VietnamBev",     						"APAC/Vietnam")
				, ( "Market",    "VietnamFoods",     					"APAC/Vietnam")
				, ( "Market",    "AMESA",     							"EMEA")
				, ( "Market",    "AMESA HQ",     						"EMEA")
				, ( "Market",    "AMENA HQ",     						"EMEA")
				, ( "Market",    "MENA FOBO",     						"EMEA")
				, ( "Market",    "Europe",     							"EMEA")
				, ( "Market",    "CHS",     							"EMEA")
				, ( "Market",    "Europe HQ",     						"EMEA")
				, ( "Market",    "Sector HQ",     						"EMEA")
				, ( "Market",    "Baltics-EER",     					"EMEA/Baltics")
				, ( "Market",    "Belgium",     						"EMEA/Belgium")
				, ( "Market",    "BUCCA",     							"EMEA/BUCCA")
				, ( "Market",    "Cyprus",     							"EMEA/Cyprus")
				, ( "Market",    "DACH",     							"EMEA/DACH")
				, ( "Market",    "Egypt",     							"EMEA/Egypt")
				, ( "Market",    "France",     							"EMEA/France")
				, ( "Market",    "Germany",     						"EMEA/Germany")
				, ( "Market",    "Greece",     							"EMEA/Greece")
				, ( "Market",    "Iberia",     							"EMEA/Iberia")
				, ( "Market",    "India",     							"EMEA/India")
				, ( "Market",    "Ireland",     						"EMEA/Ireland")
				, ( "Market",    "Italy",     							"EMEA/Italy")
				, ( "Market",    "Netherlands",     					"EMEA/Netherlands")
				, ( "Market",    "Nordics",     						"EMEA/Nordics")
				, ( "Market",    "NWE",     							"EMEA/NWE")
				, ( "Market",    "Pakistan",     						"EMEA/Pakistan")
				, ( "Market",    "Poland",     							"EMEA/Poland")
				, ( "Market",    "Romania",     						"EMEA/Romania")
				, ( "Market",    "Russia",     							"EMEA/Russia")
				, ( "Market",    "Russia Dairy",     					"EMEA/Russia")
				, ( "Market",    "Russia SPO1",     					"EMEA/Russia")
				, ( "Market",    "Saudi Arabia Jeddah",     			"EMEA/Saudi Arabia")
				, ( "Market",    "Saudi Arabia Riyadh",     			"EMEA/Saudi Arabia")
				, ( "Market",    "Saudi Snacks UAE",     				"EMEA/Saudi Arabia")
				, ( "Market",    "Serbia",     							"EMEA/Serbia")
				, ( "Market",    "South Africa",    	 				"EMEA/South Africa")
				, ( "Market",    "South Africa Snacks",    	 			"EMEA/South Africa")
				, ( "Market",    "SSA",     							"EMEA/SSA")
				, ( "Market",    "SWE",     							"EMEA/SWE")
				, ( "Market",    "Turkey",     							"EMEA/Turkey")
				, ( "Market",    "UK",     								"EMEA/UK")
				, ( "Market",    "UKI",     							"EMEA/UKI")
				, ( "Market",    "Ukraine",     						"EMEA/Ukraine")
				, ( "Market",    "WEST",     							"EMEA/WEST")
				, ( "Market",    "CGF",     							"Global")
				, ( "Market",    "Data & Analytics",     				"Global")
				, ( "Market",    "Digital Product & Services (DPS)",	"Global")
				, ( "Market",    "Global Business Services (GBS)",		"Global")
				, ( "Market",    "Global Commercial-GTM",     			"Global")
				, ( "Market",    "Global Finance",     					"Global")
				, ( "Market",    "Global HR",     						"Global")
				, ( "Market",    "Global Operations",     				"Global")
				, ( "Market",    "Global Procurement",     				"Global")
				, ( "Market",    "Global Research & Development",     	"Global")
				, ( "Market",    "Global Strategy & Transformation (S&T)",	"Global")
				, ( "Market",    "Other Global Functions",     			"Global")
				, ( "Market",    "IT",     								"Global")
				, ( "Market",    "S&T",     							"Global")
				, ( "Market",    "LATAM",     							"LATAM")
				, ( "Market",    "LA-HQ",     							"LATAM")
				, ( "Market",    "Latin American Beverages",     		"LATAM")
				, ( "Market",    "LAB Central",     					"LATAM")
				, ( "Market",    "Andean",     							"LATAM/Andean")
				, ( "Market",    "Argentina",     						"LATAM/Argentina")
				, ( "Market",    "Brazil Foods",     					"LATAM/Brazil")
				, ( "Market",    "Brazil",     							"LATAM/Brazil")
				, ( "Market",    "Brazil LAF",     						"LATAM/Brazil")
				, ( "Market",    "CariCam",     						"LATAM/CariCam")
				, ( "Market",    "Chile",     							"LATAM/Chile")
				, ( "Market",    "Colombia",     						"LATAM/Colombia")
				, ( "Market",    "Costa Rica",     						"LATAM/Costa Rica")
				, ( "Market",    "Dominican Republic",     				"LATAM/Dominican Republic")
				, ( "Market",    "Ecuador",     						"LATAM/Ecuador")
				, ( "Market",    "El Salvador",     					"LATAM/El Salvador")
				, ( "Market",    "Guatemala",     						"LATAM/Guatemala")
				, ( "Market",    "Honduras",     						"LATAM/Honduras")
				, ( "Market",    "Mexico",     							"LATAM/Mexico")
				, ( "Market",    "Mexico Foods",     					"LATAM/Mexico")
				, ( "Market",    "Panama",     							"LATAM/Panama")
				, ( "Market",    "Peru",     							"LATAM/Peru")
				, ( "Market",    "Puerto Rico",     					"LATAM/Puerto Rico")
				, ( "Market",    "SOCO",     							"LATAM/SOCO")
				, ( "Market",    "Uruguay",     						"LATAM/Uruguay")
				, ( "Market",    "Venezuela",     						"LATAM/Venezuela")
				, ( "Market",    "PBNA",     							"NA/Bevs")
				, ( "Market",    "PCNA-PCUS",     						"NA/Bevs")
				, ( "Market",    "PBC Canada Bevs",     				"NA/Canada Bevs")
				, ( "Market",    "PepsiCo Foods Canada",     			"NA/Canada Foods")
				, ( "Market",    "PFNA",     							"NA/Foods")
				, ( "Market",    "Gatorade",     						"NA/Gatorade")
				, ( "Market",    "Quaker",     							"NA/Quaker")
				, ( "Market",    "Tropicana",     						"NA/Tropicana")
				, ( "Market",    "PBC US",     							"NA/US Bevs")
				, ( "Market",    "Frito-Lay US",     					"NA/US Foods")
				, ( "Market",    "PGCS",     							"PGCS")
				, ( "Market",    "SodaStream",     						"SodaStream")    		    
  			) AS TempTableName ( Field, Input, Output )
		),

	-- ### For each non-clarity deployment update the Tier, Function and Market based on the lookup table
	NON_CLRTY_DEPLOYMENTS_PT4 AS (
		SELECT
		  ncd3.INV_INT_ID
		  , ncd3.INV_EXT_ID
		  , ncd3.INVESTMENT_NAME
		  , ncd3.ROADMAP_ELEMENT
		  , ncd3.TASKEXTID
		  , ncd3.TASK_NAME
		  , ncd3.TASK_START
		  , ncd3.TASK_FINISH
		  , ncd3.MILESTONE_STATUS
		  , ncd3.INITIATIVE_STATUS
		  , ncd3.PARENT_INT_ID
		  , ncd3.PARENT_EXT_ID
		  , ncd3.PARENT_NAME
		  , dp_a.Output AS INV_TIER
		  , COALESCE( dp_b.Output, '-Unrecognised-' ) AS INV_FUNCTION
		  , COALESCE( dp_c.Output, '-Unrecognised-' ) AS INV_MARKET
		  , ncd3.INV_TYPE
		FROM NON_CLRTY_DEPLOYMENTS_PT3 ncd3
		LEFT JOIN DEPLOYMENT_PARAMS dp_a ON ( ncd3.TIER = dp_a.Input ) AND ( 'Tier' = dp_a.Field )
		LEFT JOIN DEPLOYMENT_PARAMS dp_b ON ( ncd3.FUNCTION = dp_b.Input ) AND ( 'Function' = dp_b.Field )
		LEFT JOIN DEPLOYMENT_PARAMS dp_c ON ( ncd3.MARKET = dp_c.Input ) AND ( 'Market' = dp_c.Field )
	),

	-- ### Put Non-Clarity deployment details in same format as Clarity deployment details
	NON_CLRTY_DEPLOYMENTS_PT5 AS (
		SELECT
		  INV_INT_ID
		  , INV_EXT_ID
		  , INV_TYPE AS CLRTY_INV_TYPE
		  , INVESTMENT_NAME
		  , ROADMAP_ELEMENT
		  , TASK_NAME
		  , TASK_START
		  , TASK_FINISH
		  , INITIATIVE_STATUS AS INV_OVERALL_STATUS
		  , MILESTONE_STATUS
		  , INV_TIER
		  , INV_FUNCTION
		  , INV_MARKET
		FROM NON_CLRTY_DEPLOYMENTS_PT4
	),

	-- ### Add a 'Phases' roadmap_element row for each Non-Clarity deployment
	NON_CLRTY_DEPLOYMENTS_PT6 AS (
		( SELECT
			*
		  FROM NON_CLRTY_DEPLOYMENTS_PT5 
		  WHERE CLRTY_INV_TYPE IS NOT NULL -- Excludes inactive investments
		)
		UNION
		( SELECT 
		    INV_INT_ID
		    , INV_EXT_ID
		    , CLRTY_INV_TYPE
		    , INVESTMENT_NAME
		    , 'Phases' AS ROADMAP_ELEMENT
		    , 'Unphased' AS TASK_NAME
		    , TASK_START
		    , TASK_FINISH
		    , INV_OVERALL_STATUS
		    , MILESTONE_STATUS
		    , INV_TIER
		    , INV_FUNCTION
		    , INV_MARKET
		  FROM NON_CLRTY_DEPLOYMENTS_PT5
		  WHERE ROADMAP_ELEMENT = 'Investment'
		   AND CLRTY_INV_TYPE IS NOT NULL -- Excludes inactive investments
		)
	),

	INVESTMENTS_PT1 AS (
	-- ### Get a list of active projs, progs, portfolios
		SELECT
		  INV_INTERNAL_ID
		  , INV_EXTERNAL_ID
		  , INV_NAME
		  , INV_TYPE_NAME AS INV_TYPE
		  , BUSINESS_FUNCTION
		  , SUBSTRING_INDEX( IMPACTED_MARKET_UNITS, ',', 1) AS IMPACTED_MARKET --Temp solution: Get first market from string only
		FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_investments_v
		WHERE INV_ACTIVE = 'Yes'
		  AND INV_TYPE_NAME IN ('Project', 'Programs', 'Portfolios')
	),

	TIERS AS (
	-- ### Get tiers from Clarity for each Proj and Prog then convert using lookup
		SELECT
		  t.ID
		  , t.EXT_ID
		  , t.NAME
		  , dp.Output AS TIER
		FROM (
			SELECT
			  ID
			  , PROJECT_NUMBER AS EXT_ID
			  , PROJECT_NAME AS NAME
			  , TIER
			FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_project_corporate_v
			UNION
			SELECT
			  ID
			  , PROJECT_NUMBER AS EXT_ID
			  , PROJECT_NAME AS NAME
			  , TIER
			FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_project_v
			UNION
			SELECT 
			  ID
			  , CODE AS EXT_ID
			  , NAME
			  , TIER
			FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_program_v
		) t
		LEFT JOIN DEPLOYMENT_PARAMS dp ON ( t.TIER = dp.Input ) AND ( 'Tier' = dp.Field )
	),

	INVESTMENTS_PT2 AS (
	-- ### Get standard Tier, Function, and Market params for each active proj, prog, portfolio
		SELECT
		  i.INV_INTERNAL_ID
		  , i.INV_EXTERNAL_ID
		  , i.INV_NAME
		  , i.INV_TYPE
		  , i.BUSINESS_FUNCTION
		  , i.IMPACTED_MARKET
		  , t.TIER AS INV_TIER
		  , dp_a.Output AS INV_FUNCTION
		  , dp_b.Output AS INV_MARKET
		FROM INVESTMENTS_PT1 i
		LEFT JOIN TIERS t ON i.INV_INTERNAL_ID = t.ID
		LEFT JOIN DEPLOYMENT_PARAMS dp_a ON ( i.BUSINESS_FUNCTION = dp_a.Input ) AND ( 'Function' = dp_a.Field )
		LEFT JOIN DEPLOYMENT_PARAMS dp_b ON ( i.IMPACTED_MARKET = dp_b.Input ) AND ( 'Market' = dp_b.Field )
	),

	-- ### Get the unique ID of the latest status report for each investment
	STATUS_LATEST_REPORT_ID AS (
		SELECT
		  PROJECT_CODE
		  , MAX( INTERNAL_ID ) AS LATEST_RPT_INT_ID
		FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_status_report_history_v
		GROUP BY PROJECT_CODE
	),

	STATUS_RPT_KEY_DETAILS AS (
	-- ### Get the overall status colour for each status report
		SELECT
		  PROJECT_CODE
		  , PROJECT_NAME
		  , INTERNAL_ID
		  , STATUS_ID
		  , PUBLISH_DATE
		  , ST_STS_OVERALL
		FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_status_report_history_v
	),

	INVESTMENTS_PT3 AS (
	-- ### Append the overall status from the latest status report to the investments key details
		SELECT
		  i.INV_INTERNAL_ID
		  , i.INV_EXTERNAL_ID
		  , i.INV_NAME
		  , i.INV_TYPE
		  , i.INV_TIER
		  , i.INV_FUNCTION
		  , i.INV_MARKET
		  , d.ST_STS_OVERALL AS INV_OVERALL_STATUS
		FROM INVESTMENTS_PT2 i
		LEFT JOIN STATUS_LATEST_REPORT_ID l
		  ON i.INV_EXTERNAL_ID = l.PROJECT_CODE
		LEFT JOIN STATUS_RPT_KEY_DETAILS d
		  ON l.PROJECT_CODE = d.PROJECT_CODE
		  AND l.LATEST_RPT_INT_ID = d.INTERNAL_ID
	),

	-- For each roadmap item append its Investment Type, Status, Tier, Function and Market
	CLRTY_ROADMAP_w_PARAMS AS (
		SELECT
		cri.INV_INT_ID
		, cri.INV_EXT_ID
		, ip3.INV_TYPE AS CLRTY_INV_TYPE
		, cri.INVESTMENT_NAME
		, cri.ROADMAP_ELEMENT
		, cri.TASK_NAME
		, cri.TASK_START
		, cri.TASK_FINISH
		, COALESCE( ip3.INV_OVERALL_STATUS, 'Grey' ) AS INV_OVERALL_STATUS
		, cri.MILESTONE_STATUS
		, ip3.INV_TIER
		, ip3.INV_FUNCTION
		, ip3.INV_MARKET		
		FROM CLRTY_ROADMAP_ITEMS cri
		LEFT JOIN INVESTMENTS_PT3 ip3
		  ON ( cri.INV_INT_ID = ip3.INV_INTERNAL_ID )
		WHERE ip3.INV_TYPE IS NOT NULL -- Excludes inactive investments
		ORDER BY cri.INVESTMENT_NAME, cri.ROADMAP_ELEMENT, cri.TASK_START
	)


-- ### Resulting query: Union details of each clarity investment's roadmap items with those that aren't properly setup in Clarity
SELECT * FROM CLRTY_ROADMAP_w_PARAMS
UNION
SELECT * FROM NON_CLRTY_DEPLOYMENTS_PT6