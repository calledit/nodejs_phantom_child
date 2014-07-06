
//var WebSocketServer = require('ws').Server
  //, wss = new WebSocketServer({port: 23815});
  //

var spawn = require('win-spawn'),
    http = require('http');

var CachedValues = [];


var nodejsphantom = {
    phantomProccess:null,
	clientReciver:null,
    RpcPort: 45823,
    options:{},
    init:function(binary, OnDone, PhantomPort, options){
        if(typeof(binary) == 'undefined'){
            binary = 'phantomjs';
        }
        if(PhantomPort){
            nodejsphantom.RpcPort = PhantomPort;
        }
        if(typeof(options) != 'undefined'){
            nodejsphantom.options = options;
        }
        
        if(typeof(nodejsphantom.options.args) == 'undefined'){
            nodejsphantom.options.args = [];
        }
        nodejsphantom.phantomProccess = spawn(binary, nodejsphantom.options.args.concat([__dirname + '/child_script.js', nodejsphantom.RpcPort]));
        nodejsphantom.phantomProccess.stdout.on('data', nodejsphantom.options.onStdout || function(data){
            console.log("Phantom Stdout: "+data)
        });
        nodejsphantom.phantomProccess.stderr.on('data', nodejsphantom.options.onStderr || function(data){
            console.log("Phantom Stderr: "+data)
        });
        nodejsphantom.phantomProccess.on('error', function(err) {
            if((err != null ? err.code : void 0) === 'ENOENT'){
                console.error("Is phantomjs installed? There was an error with it.")
            }else{
                console.error("phantomjs failed somehow");
            }
        });
        nodejsphantom.phantomProccess.on('exit', nodejsphantom.options.onExit || function(code, signal){
            console.log("Quiting, due to phantomjs Exited with exit code: ", code, signal)
			process.exit();
        });
        setTimeout(function(){
			//Asume the child has initiated after 1500 ms
			nodejsphantom.sendCommand('Ping', {}, function(PingAnswer){
				StartServerPuller(null);
				setTimeout(OnDone, 1);
			});
        }, 1500);
    }
}

function StartServerPuller(AnswerToServer){
	nodejsphantom.sendCommand('Answer', AnswerToServer, function(DataFromServer){
		var NewAns = null;
		if(typeof(nodejsphantom.clientReciver) == 'function'){
			NewAns = nodejsphantom.clientReciver(DataFromServer);
		}
		setTimeout(function(){
			console.log("answer pull message with", NewAns)
			StartServerPuller(NewAns);
		}, 1);
	});
}


nodejsphantom.execFunc = function execFunc(Func, args, callback){
	var PublicArgs = [];
	for(var ArgNUm in args){
		PublicArgs[ArgNUm] = ObjToPublicDescriptor(args[ArgNUm]);
	}
	var FuncDescriptor = {'args': PublicArgs};
	if(typeof(Func) == 'function'){
		FuncDescriptor.FuncText = Func.toString();
	}else if(typeof(Func) == 'number'){
		FuncDescriptor.FuncPublicId = Func;
	}else{
		console.error("Func needs to be either a function or a public id")
	}
	nodejsphantom.sendCommand('execFunc', FuncDescriptor, function(DataFromServer){
		var RemoteObj = PublicDescriptorToObj(DataFromServer);
		callback(RemoteObj);
	});
}
function ObjToPublicDescriptor(Obj){
	if(typeof(Obj) == 'object'){
		if(typeof(Obj.remoteId) != 'undefined'){
			return({'_id':Obj.remoteId})
		}else{
			return({'obj':Obj})
		}
	}else if(typeof(Obj) == 'function'){
		if(typeof(Obj.remoteId) != 'undefined'){
			return({'_id':Obj.remoteId})
		}else{
			console.error("Cant send a function from nodejs to remote")
		}
	}
	return(Obj);
}

function PublicDescriptorToObj(PublicObj){
	if(typeof(PublicObj) == 'object' && typeof(PublicObj['_id']) == 'number' && typeof(PublicObj['type']) != 'undefined'){
		if(PublicObj['type'] == 'function'){
			var retFunc = (function(RemoteValueID){
				return(
function(){
	var args = Array.prototype.slice.call(arguments);
	ResultCallback = args.pop();
	if(typeof(ResultCallback) != 'function'){
		console.error("The Last argument of all remote commands most always be a callback: funcid "+RemoteValueID+"()")
	}
	nodejsphantom.execFunc(RemoteValueID, args, ResultCallback);
}
			);
			})(PublicObj['_id']);
			Object.defineProperty(retFunc, 'remoteId', {configurable: false, enumerable: false, writable: true, value: PublicObj['_id']});
			return(retFunc);
		}else if(PublicObj['type'] == 'object'){
			Object.defineProperty(PublicObj['obj'], 'remoteId', {configurable: false, enumerable: false, writable: true, value: PublicObj['_id']});
			for(var key in PublicObj['obj']){
				PublicObj['obj'][key] = PublicDescriptorToObj(PublicObj['obj'][key]);
			}
			return(PublicObj['obj']);
		}
	}
	//Is simple thing "hopefully"
	return(PublicObj);
}

nodejsphantom.sendCommand = function sendCommand(Command, Value, callback){
    JsonTosend = ToPhantJson({'Command':Command, 'Value': Value});
    var Headers = {'Content-length': JsonTosend.length}
    var req = http.request({hostname:'localhost', headers: Headers, port:nodejsphantom.RpcPort, path:'/to_phantom', method: 'POST', agent: false}, function (res) {
        var RecivedJson = ""
        res.on('data', function (chunk) {
            RecivedJson += chunk;
        });
        res.on('close', function (chunk) {
            RecivedJson += chunk;
        });
        res.on('end', function () {
            if(RecivedJson != ''){
				var RetDat = true;
				try{
					RetDat = JSON.parse(RecivedJson);
				}catch(e){
					RetDat = false;
				}
                if(!RetDat){
                    console.error('The returned data is not valid JSON', RecivedJson);
                }else{
                    callback(RetDat);
                }
            }else{
                console.error('Answer from phantom contained no returned data');
            }
        });
    })
    req.on('error', function(e) {
        console.error('SOme kind of error when comuniccationg with phantomjs: ' + e.message);
    });
    req.write(JsonTosend);
    req.end();
}

/*
function ExecRemote(_id, args, ResultCallback){
    sendCommand("Exec", {'what':_id,'args':args}, function(RetDat){
        //console.log("Got answer to Exec of ("+_id+"):", dump(RetDat));
		ResultCallback(RetDat);
    });
}

nodejsphantom.clientReciver = function(MessageFromPhantom){
	
	console.log("Got a pulling message from phantom",MessageFromPhantom)
	return("Got the pulling message:"+MessageFromPhantom);
}
//var RemoteService = null
nodejsphantom.init("../patched_phantomjs", function(RemoteResult){
	//RemoteService = RemoteResult;
    console.log("Started Child pinged it then established conenction to it.");

	

    console.log("Sending test command");

	sendCommand("Test", "Test Message to Phantom", function(answer){
		console.log("Got answer to test command:",answer);
	});

});


function RemoteFromPublicObj(PublicObj){
	var RemoteObj = {};
    for(var key in PublicObj){
		if(typeof(PublicObj[key]._id) == 'number'){//Found Depest level
			if(typeof(RemoteObj[key]) == 'undefined'){
				RemoteObj[key] = {};
			}
			if(PublicObj[key].type == 'function'){
				var RemoteFunctionId = PublicObj[key]._id;
				var FunctionName = key;
				(function(RemoteValueID, FunctionName){
					RemoteObj[FunctionName] = function(){
						var args = Array.prototype.slice.call(arguments);
						ResultCallback = args.pop();
						if(typeof(ResultCallback) != 'function'){
							console.error("The Last argument of all remote commands most always be a callback: "+FunctionName+"()")
						}
						ExecRemote(RemoteFunctionId, args, ResultCallback);
					}
				})(RemoteFunctionId, FunctionName);
			}else{
				var RemoteValueID = PublicObj[key]._id
				CachedValues[RemoteValueID+'_'+key] = PublicObj[key].orgValue;
				(function(RemoteValueID, RemoteName){
					Object.defineProperty(RemoteObj, RemoteName, {
						configurable: false,
						enumerable : true,
						set : function(value){
							  CachedValues[RemoteValueID+'_'+RemoteName] = value;
						},
						get : function(){
							  //return(RemoteValueID+'_'+RemoteName);
							  return(CachedValues[RemoteValueID+'_'+RemoteName]);
						},
					});
				})(RemoteValueID, key);
			}
		}else{
			RemoteObj[key] = RemoteFromPublicObj(PublicObj[key]);
		}
	}
	return(RemoteObj);
}


//sendCommand("ListPublic", {}, function(RemoteResult){
//});

	
	console.log(RemoteService);


	RemoteService.webPage.create(function(page){
		console.log("created phantom page: ", page.plainText, page.libraryPath);
		
		console.log(dump(page))
		url = 'file:///Users/calle.sagulin/Downloads/GANT IT Heads Up.html'
		page.open('http://www.google.com/', function(status) {
			console.log('Phantom Featched Google.com Need to reload values: ' , status);
			// Do other things here...
		}, function(OpenRet){
			console.log('NodeJs Featched google.com ', OpenRet);
		});
	})


function PreDump(S, cache, cacheInfo, road){
    if(typeof(cache) == 'undefined'){
        cache = [];
        cacheInfo = [];
        road = [];
    }
    var Dp = {};
    for(var key in S){
        road.push(key);
        var roadJoin = road.join('.');
        var cacheid = cache.indexOf(S[key]);
        if (cacheid == -1) {
            if(typeof(S[key]) == 'object' && S[key] !== null){
                cacheInfo.push([roadJoin]);
                cache.push(S[key]);
                Dp[key] = PreDump(S[key], cache, cacheInfo, road);
            }else if(typeof(S[key]) === 'function'){
                var TmDm = PreDump(S[key], cache, cacheInfo, road);
                var FCont = S[key].toString().replace("\n    [native code]\n", "[native code]")
                if(TmDm.length == 0){
                    Dp[key] = {};
                    Dp[key][FCont] = TmDm;
                }else{
                    Dp[key] = FCont;
                }
            }else{
                Dp[key] = S[key];
            }
        }else{
            Dp[key] = "Cyclic previosly Found in: " + cacheInfo[cacheid].join(',');
            cacheInfo[cacheid].push(roadJoin);
        }
        road.pop(key);
    }
    return(Dp);
}
function dump(In){
    return(JSON.stringify(PreDump(In), null, 4));
}
*/

function ToPhantJson(In){
    return(JSON.stringify(In, null, 4));
}


module.exports = nodejsphantom;
