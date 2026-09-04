USE learnvault_db;


/* =====================================================
   STUDENT RESOURCE + VIDEO PHASE
===================================================== */


/*
   Videos can be stored as external learning links
   (for example YouTube / institutional video links).

   Existing content upload API already supports external_url,
   so only the Video resource type is required here.
*/

INSERT IGNORE INTO resource_types
(
    type_name
)
VALUES
(
    'Video'
);


/* =====================================================
   VERIFY
===================================================== */

SELECT
    id,
    type_name

FROM resource_types

ORDER BY
    type_name;
