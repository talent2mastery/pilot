'use strict';

var fs                          = require('fs');
var path                        = require('path');
const uuidv1                    = require('uuid/v1');
var sqlite3                     = require('sqlite3');
var os                          = require('os')
var db_helper                   = require("./db_helper")
var userData
var childProcessName
var dbsearch;
var setProcessToRunning;
var setProcessToIdle;
var setProcessRunningDurationMs;
var processesInUse                      = new Object()
var tryAgain                            = true
var nextCallId                          = 0
var updateProcessTable                  = null;
var username                            = "node"
var callList                            = new Object
var processesRetryingCount              = 0
var maxProcessesCountToRetry            = 10
var maxJobProcessDurationMs             = 10000
var showDebug = false
var showProgress = false
function outputDebug(text) {
    if (showDebug) {
         console.log(text);
    } else {
        if (showProgress) {
            process.stdout.write(".");
        }
    }
};



//-----------------------------------------------------------------------------------------//
//                                                                                         //
//                             processMessagesFromMainProcess                              //
//                                                                                         //
//   This is the main event loop that waits for messages from the main NodeJS child.js     //
//   process                                                                               //
//                                                                                         //
//                                                                                         //
//-----------------------------------------------------------------------------------------//
processMessagesFromMainProcess();



function processMessagesFromMainProcess() {
    process.on('message', (msg) => {


    //-----------------------------------------------------------------------------------------
    //
    //                                            init
    //
    // This just sets up the Scheduler by connecting to the database, and sets up some
    // prepared SQL statements
    //
    //-----------------------------------------------------------------------------------------
    if  (msg.message_type == 'init') {

        //console.log('-- Init v3');
        userData                    = msg.user_data_path
        childProcessName            = msg.child_process_name
        showDebug                   = msg.show_debug
        showProgress                = msg.show_progress

        if (msg.max_processes_count_to_retry) {
            maxProcessesCountToRetry    = msg.max_processes_count_to_retry
        }
        if (msg.max_job_process_duration_ms) {
            maxJobProcessDurationMs    = msg.max_job_process_duration_ms
        }


        //console.log("  Child recieved user data path: " + userData)
        var dbPath = path.join(userData, username + '.visi')

        //console.log("  DB path: " + dbPath)
        dbsearch = new sqlite3.Database(dbPath);
        dbsearch.run("PRAGMA journal_mode=WAL;")
        process.send({  message_type:       "database_setup_in_child" ,
                        child_process_name:  childProcessName
                        });
        setUpSql()





    //-----------------------------------------------------------------------------------------
    //
    //                                   setUpSql
    //
    // This sets up some prepared SQL statements
    //
    //-----------------------------------------------------------------------------------------
    } else if (msg.message_type == 'setUpSql') {

         setUpSql();





     //-----------------------------------------------------------------------------------------
     //
     //                                   function_call_response
     //
     // This is called to return the response of a call
     //
     //-----------------------------------------------------------------------------------------
     } else if (msg.message_type == "function_call_response") {

         //console.log("*) Response received at Scheduler ")
         //console.log("*) result generated by call ID: " + msg.called_call_id)
         var callDetails = callList[msg.called_call_id]
         //console.log("*) call details: " + JSON.stringify(msg,null,2))

         if (callDetails == null) {
            console.log("In Scheduler:function_call_response   callList    is not set for : " + JSON.stringify(msg,null,2))
            return
         }
         var parentCallId = callDetails.parent_call_id
         //console.log("*) parent call ID: " + JSON.stringify(parentCallId,null,2))

         var processName
         if (parentCallId == -1) {
             processName = "forked"
         } else {
             var parentCallDetails = callList[parentCallId]
             //console.log("*) parent call details: " + JSON.stringify(parentCallDetails,null,2))
             //console.log("*) Response: " + JSON.stringify(msg.result,null,2))
             processName = parentCallDetails.process_name
         }

         //console.log("msg.callback_index returned: " + msg.callback_index)
         process.send({     message_type:       "return_response_to_function_caller" ,
                            child_process_name:  processName,
                            callback_index:      msg.callback_index,
                            result:              msg.result
                        });






    //-----------------------------------------------------------------------------------------
    //
    //                                   processor_free
    //
    // This is called whenever one of the code processors is free. They should only be allowed
    // to process one thing at a time
    //
    //-----------------------------------------------------------------------------------------
     } else if (msg.message_type == "processor_free") {


        dbsearch.serialize(
            function() {
                dbsearch.run("begin exclusive transaction");
                setProcessToIdle.run(msg.child_process_name)

                dbsearch.run("commit", function() {
                    processesInUse[msg.child_process_name] = false
                });
            })







    //-----------------------------------------------------------------------------------------
    //
    //                                   function_call_request
    //
    // This is called to call code.
    //
    //-----------------------------------------------------------------------------------------
     } else if (msg.message_type == "function_call_request") {

        if (msg.find_component.driver_name && msg.find_component.method_name) {
            dbsearch.serialize(
                function() {
                    var stmt = dbsearch.all(
                      "SELECT * FROM system_code where base_component_id = ? " +
                        " and code_tag = 'LATEST'; ",

                       msg.find_component.driver_name,

                        function(err, results)
                        {
                            if (results && (results.length > 0)) {
                               scheduleJobWithCodeId(  results[0].id,
                                                       msg.args,
                                                       msg.caller_call_id,
                                                       msg.callback_index)
                                //callbackFn(results[0].id);
                            } else {
                                //callbackFn(null)
                            }

                        })
            }, sqlite3.OPEN_READONLY)



        } else if (msg.find_component.code_id) {
           scheduleJobWithCodeId(  msg.find_component.code_id,
                                   msg.args,
                                   msg.caller_call_id,
                                   msg.callback_index)



        } else if (msg.find_component.base_component_id) {
            //console.log("In msg.find_component.base_component_id")
            dbsearch.serialize(
                function() {
                    var stmt = dbsearch.all(
                      "SELECT id FROM system_code where base_component_id = ? and code_tag = 'LATEST'; ",

                       msg.find_component.base_component_id,

                        function(err, results)
                        {
                            if (results && (results.length > 0)) {
                                //console.log("    msg.find_component.base_component_id: " + msg.find_component.base_component_id  + " = " + results[0].id)
                               scheduleJobWithCodeId(  results[0].id,
                                                       msg.args,
                                                       msg.caller_call_id,
                                                       msg.callback_index)
                                //callbackFn(results[0].id);
                            } else {
                                console.log("    msg.find_component.base_component_id: Could not find " +   msg.find_component.base_component_id)
                            }

                        })
            }, sqlite3.OPEN_READONLY)
        }











        //-----------------------------------------------------------------------------------------
        //
        //                                  startNode
        //
        // This is called when a node has been started. Noter that this does not start the
        // NodeJS process, it just updates the Sqlite database to say that the process is
        // ready to accept requests
        //
        //-----------------------------------------------------------------------------------------
        } else if (msg.message_type == 'startNode') {


             //console.log(" --- Started Node --- ")
             //console.log("     Node ID: " + msg.node_id)
             //console.log("     Process ID: " + msg.child_process_id)
             //console.log("     Started: " + msg.started)
             dbsearch.serialize(
                 function() {
                     dbsearch.run("begin exclusive transaction");
                     updateProcessTable.run(
                         msg.node_id,
                         msg.child_process_id,
                         msg.started,
                         "IDLE",
                         null
                         )
                     dbsearch.run("commit", function() {
                            processesInUse[msg.node_id] = false
                     });
                 })

        }




    });
}





//-----------------------------------------------------------------------------------------//
//                                                                                         //
//                                        setUpSql                                         //
//                                                                                         //
//   This sets up the SqlLite prepared statements                                          //
//                                                                                         //
//                                                                                         //
//                                                                                         //
//                                                                                         //
//                                                                                         //
//                                                                                         //
//-----------------------------------------------------------------------------------------//
function setUpSql() {

    setProcessToRunning = dbsearch.prepare("UPDATE system_process_info SET status = 'RUNNING', last_driver = ?, last_event = ?, running_start_time_ms = ?, event_duration_ms = 0, system_code_id = ?, callback_index = ? WHERE process = ?");

    setProcessToIdle = dbsearch.prepare("UPDATE system_process_info SET status = 'IDLE' WHERE process = ?");
    setProcessRunningDurationMs  = dbsearch.prepare("UPDATE  system_process_info  SET event_duration_ms = ?  WHERE  process = ?");


    updateProcessTable = dbsearch.prepare(
        " insert or replace into "+
        "     system_process_info (process, process_id, running_since, status, job_priority) " +
        " values " +
        "     (?,?,?,?,?)"
    )

}





//-----------------------------------------------------------------------------------------//
//                                                                                         //
//                          updateRunningTimeForprocess                                    //
//                                                                                         //
//                                                                                         //
//                                                                                         //
//-----------------------------------------------------------------------------------------//
function updateRunningTimeForprocess() {
        //console.log("Checking processes")

        dbsearch.serialize(
            function() {
                var stmt = dbsearch.all(
                  "SELECT * FROM system_process_info where  status = 'RUNNING'; ",

                    function(err, results)
                    {
                        if (results) {
                           var timeNow = new Date().getTime();
                           dbsearch.run("begin exclusive transaction");
                           for (var ii = 0 ; ii < results.length ; ii++ ) {
                               var thisProcess = results[ii]
                               var startTime = thisProcess.running_start_time_ms
                               var duration = timeNow - startTime
                               setProcessRunningDurationMs.run(duration, thisProcess.process)
                           }
                           dbsearch.run("commit", function() {
                           });
                        }

                    })
        })
}


//setInterval(updateRunningTimeForprocess,1000)
//zzz




function findLongRunningProcesses() {
        console.log("Checking processes")

        dbsearch.serialize(
            function() {
                var stmt = dbsearch.all(
                  "SELECT * FROM system_process_info where  status = 'RUNNING' and event_duration_ms > ?; ",
                   maxJobProcessDurationMs,
                    function(err, results)
                    {
                        if (results) {
                           dbsearch.run("begin exclusive transaction");
                           for (var ii = 0 ; ii < results.length ; ii++ ) {
                               var thisProcess = results[ii]
                               console.log(thisProcess)
                               //killProcess(thisProcess.process, thisProcess.callback_index)
                           }
                           dbsearch.run("commit", function() {
                           });
                        }

                    })
        })
}

//setInterval(findLongRunningProcesses,1000)

function killProcess(processName, callbackIndex) {
    dbsearch.serialize(
        function() {
            dbsearch.run("begin exclusive transaction");
            setProcessToIdle.run(processName)

            dbsearch.run("commit", function() {
                processesInUse[processName] = false
                process.send({     message_type:       "return_response_to_function_caller" ,
                                   child_process_name:  processName,
                                   callback_index:      callbackIndex,
                                   result:              {error: {
                                                            text: "Request timeout",
                                                            code: 408
                                   }}
                               });
            });
        })
}



//-----------------------------------------------------------------------------------------//
//                                                                                         //
//                            scheduleJobWithCodeId                                        //
//                                                                                         //
//                                                                                         //
//                                                                                         //
//-----------------------------------------------------------------------------------------//
function scheduleJobWithCodeId(codeId, args,  parentCallId, callbackIndex) {

    var processToUse = null
    var processNames = Object.keys(processesInUse)

    for ( var processNameIndex = 0 ; processNameIndex < processNames.length; processNameIndex ++ ) {

        var actualProcessName   = processNames[ processNameIndex ]
        var isInUse             = processesInUse[ actualProcessName ]

        //console.log(" select * from system_process_info    ")
        //console.log("    " + JSON.stringify(results,null,2))

        if ( !isInUse ) {
            processToUse = actualProcessName
            processesInUse[actualProcessName] = true
            outputDebug(" Sending job to process:    " + JSON.stringify(processToUse,null,2))
            sendJobToProcessName(codeId, args, actualProcessName, parentCallId, callbackIndex)
            return
        }
    }
    if (!processToUse) {
        console.log("Could not find a process to use for " + codeId)
        if (tryAgain) {


            var processName
            if (parentCallId == -1) {
                processName = "forked"
            } else {
                var parentCallDetails = callList[parentCallId]
                //console.log("*) parent call details: " + JSON.stringify(parentCallDetails,null,2))
                //console.log("*) Response: " + JSON.stringify(msg.result,null,2))
                processName = parentCallDetails.process_name
            }

            //console.log("msg.callback_index returned: " + msg.callback_index)
            if (processesRetryingCount < maxProcessesCountToRetry) {
                console.log("Retry in 2 seconds ..." )
                processesRetryingCount ++
                console.log("processesRetryingCount: " + processesRetryingCount)
                setTimeout(function() {
                    processesRetryingCount --
                    console.log("processesRetryingCount: " + processesRetryingCount)
                    scheduleJobWithCodeId(codeId, args,  parentCallId, callbackIndex)
                },2000)
            } else {
                process.send({     message_type:       "return_response_to_function_caller" ,
                                   child_process_name:  processName,
                                   callback_index:      callbackIndex,
                                   result:              {error: {
                                                            text: "Yazz Server too busy",
                                                            code: 503
                                   }}
                               });
            }


        }
    }
}






//-----------------------------------------------------------------------------------------//
//                                                                                         //
//                                   sendToProcess                                         //
//                                                                                         //
//                                                                                         //
//                                                                                         //
//-----------------------------------------------------------------------------------------//
function sendToProcess(  id  ,  parentCallId  ,  callbackIndex, processName  ,  base_component_id ,  on_condition  ,  args) {

    var newCallId = nextCallId ++

    callList[  newCallId  ] = {     process_name:       processName,
                                    parent_call_id:     parentCallId        }
    dbsearch.serialize(
        function() {
            dbsearch.run("begin exclusive transaction");
            let runningStartTime = new Date().getTime();
            setProcessToRunning.run( base_component_id, on_condition, runningStartTime, id, callbackIndex, processName )


            dbsearch.run("commit", function() {
                process.send({  message_type:       "execute_code_in_exe_child_process" ,
                                child_process_name:  processName,
                                code_id:             id,
                                args:                args,
                                call_id:             newCallId,
                                callback_index:      callbackIndex,
                                on_condition:        on_condition,
                                base_component_id:   base_component_id
                                });
            });
        })
}







//-----------------------------------------------------------------------------------------//
//                                                                                         //
//                                   sendJobToProcessName                                  //
//                                                                                         //
//                                                                                         //
//                                                                                         //
//-----------------------------------------------------------------------------------------//
function sendJobToProcessName(id, args, processName, parentCallId, callbackIndex) {

    dbsearch.serialize(
        function() {
            var stmt = dbsearch.all(
                "SELECT base_component_id, on_condition FROM system_code where id = ? LIMIT 1",
                id,

                function(err, results)
                {
                    if (results) {
                        if (results.length > 0) {


                            sendToProcess(  id,
                                            parentCallId,
                                            callbackIndex,
                                            processName,
                                            results[0].base_component_id,
                                            results[0].on_condition,
                                            args)



                        }
                    }
                })
    }, sqlite3.OPEN_READONLY)

}















//-----------------------------------------------------------------------------------------//
//                                                                                         //
//                                   shutdownExeProcess                                    //
//                                                                                         //
// If the process is killed then make sure we checkpoint the database to                   //
// avoid data corruption                                                                   //
//                                                                                         //
//                                                                                         //
//-----------------------------------------------------------------------------------------//
function shutdownExeProcess(err) {
    console.log("** exeScheduler process was killed: " )
    if (err) {
        console.log("    : " + err)
    }


    if (dbsearch) {
        dbsearch.run("PRAGMA wal_checkpoint;")
    }
}

process.on('exit', function(err) {
    shutdownExeProcess(err);
  });
process.on('quit', function(err) {
  shutdownExeProcess(err);
});
