const electron = require('electron')


// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow
var startNodeServer =true
const path = require("path");
const url = require('url');
var fs = require('fs');
var ip = require('ip');
var isWin         = /^win/.test(process.platform);
var sqlite3                     = require('sqlite3');
var os              = require('os')
var username = os.userInfo().username.toLowerCase();

var dbPath = null

var dbsearch = null
var userData = null
//zzz
var port;
var hostaddress;
  var ls = null
hostaddress = ip.address();
port = 80
var f = 0
var started = false

var visifile
app.on('ready', function() {

    userData = app.getPath('userData')
    dbPath = path.join(userData, username + '.visi')

    visifile = new BrowserWindow({
                                width: 800,
                                height: 600,
                                webPreferences: {
                                    nodeIntegration: false

                                },
                                icon:'public/VisiFileColor.png'
                            })

    visifile.loadURL(url.format({
        pathname: path.join(__dirname, 'loading.html'),
        protocol: 'file:',
        slashes: true
      }))

      outputToBrowser("appPath: " + app.getAppPath())
      outputToBrowser("getPath(userData): " + app.getPath('userData'))
      outputToBrowser("dbPath: " + dbPath)
      outputToBrowser("LOCAL: " + path.join(__dirname, '/'))
    //visifile.webContents.toggleDevTools();

    dbsearch = new sqlite3.Database(dbPath);
    dbsearch.serialize(
        function() {
            dbsearch.all(
                "SELECT count(name) as cnt FROM sqlite_master ;  "
                ,

                function(err, results)
                {
                    for (var i = 0; i < results.length; i++) {
                        outputToBrowser("Sqlite: " + results[i].cnt)
                    }


                })
    }, sqlite3.OPEN_READONLY)



	var nodeConsole = require('console');
	var myConsole = new nodeConsole.Console(process.stdout, process.stderr);
	myConsole.log('Hello World!');



    console.log("New electron app")

    //var index = require(path.resolve('src/index.js'))



    if (startNodeServer) {
        var exec = require('child_process').exec;

    	if (isWin) {
    		ls    = exec('cd ' + path.join(__dirname, '..') + ' & pwd & ls & cd visifile & .\\node .\\src\\index.js --nogui true')
    	} else {
    			ls = exec('cd ' + path.join(__dirname, '..') + ' && pwd && ls && cd visifile && ./node src/index.js --nogui true')
    	}

        var readhost = ''
        var readport = ''
    	ls.stdout.on('data', function (data) {
            var ds = data.toString()
            if (!started) {
                outputToBrowser(ds)
            }

            if (ds.indexOf("****HOST") != -1) {
                readhost = ds.substring(ds.indexOf("****HOST") + 9, ds.indexOf("HOST****")).replace(/\'|\"|\n|\r"/g , "")
                //console.log("readhost=" + readhost)
            }


            if (ds.indexOf("****PORT") != -1) {
                   readport = ds.substring(ds.indexOf("****PORT") + 9, ds.indexOf("PORT****")).replace(/\'|\"|\n|\r"/g , "")
                   //console.log("readport=" + readport)
            		var addrt = 'http://' + readhost + ':' + readport;
                    outputToBrowser("****Started address:= " + addrt)
                    setTimeout(function(){
                        if (startNodeServer) {
                            visifile.loadURL(addrt)
                        }

                    },1000)



                    started = true
                }

    	});
    }
})
process.on('exit', function() {
	if (ls) {
		console.log("Killed Process VisiFile")
		ls.kill();
	}
  });



function outputToBrowser(txt) {
    f++

    //var line = txt.toString().replace(/\'|\"|\n|\r"/g , "").toString()
    var line = txt.toString().replace(/\'/g , "").toString()
    var jsc = "document.write('<br>" + ": " + line + " ')"
    //console.log(line);
    visifile.webContents.executeJavaScript(jsc);
}
