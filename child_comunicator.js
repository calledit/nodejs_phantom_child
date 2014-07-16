
var spawn = require('win-spawn'),
    http = require('http');

var CachedValues = [];


function ChildCom(binaryFileName, rpcPort, onBinaryRunning, options){
	
	//Check that arguments and such is OK
	if(this.constructor != arguments.callee){
		throw ('Programing Error: The function "'+arguments.callee.name+'" most be created as an instance with the javascript new operator');
	}
	this.className = arguments.callee.name;
	var self = this;

    if(typeof(binaryFileName) != 'string'){
		throw ('Argument Error: argument binaryFileName needs to be set to a string. Value was:'+binaryFileName);
	}
	self.binaryFileName = binaryFileName;

    if(typeof(onBinaryRunning) == 'undefined'){
		onBinaryRunning = function(){
			console.log('Child "'+self.binaryFileName+'" is now running')
		};
	}
	self.rpcPort = rpcPort;

    if(typeof(rpcPort) != 'number'){
		throw ('Argument Error: argument rpcPort needs to be set to a number. Value was: '+rpcPort);
	}
	self.rpcPort = rpcPort;
	
	if(typeof(options) == 'undefined'){
		options = {};
	}
	self.options = options;
	
	if(typeof(self.options.args) == 'undefined'){
		self.options.args = [];
	}

	//Spawn the binary and attach all the required callbacks
    self.childProcess = spawn(self.binaryFileName, self.options.args.concat([__dirname + '/child_script.js', self.rpcPort]));
	self.childProcess.stdout.on('data', self.options.onStdout || function(data){
		console.log('Child "'+self.binaryFileName+'" Stdout: '+data)
	});
	self.childProcess.stderr.on('data', self.options.onStderr || function(data){
		console.log('Child "'+self.binaryFileName+'" Stderr: '+data)
	});
	self.childProcess.on('error', function(err) {
		if((err != null ? err.code : void 0) === 'ENOENT'){
			throw('ChildError: Does the child binary "'+self.binaryFileName+'" exsist? There was an error with it.');
		}else{
			throw('ChildError: The child binary "'+self.binaryFileName+'" failed somehow.');
		}
	});
	self.childProcess.on('exit', self.options.onExit || function(code, signal){
		console.log('Child "'+self.binaryFileName+'" exited, with exit code: ', code, signal)
	});

	//Send ping to child to see if it is upp and running
	self.pingUntilPong(function(){
		self.startServerPuller(null);
		onBinaryRunning();
	},function(){
		console.error('Could not initiate a connection to child "'+self.binaryFileName+'" somthing most be wrong with the child.');
	})
}

ChildCom.prototype.pingUntilPong = function pingUntilPong(onOK, failCounter, onFail){
	var self = this;
	self.sendCommand('Ping', {}, function(PingAnswer){
		//Got Pong run callback
		onOK(failCounter);
	},function(e){
		//Did not get pong repport failiure if tried to many times or wait and try again
		if(failCounter<0){
			onFail(failCounter);
		}else{
			setTimeout(function(){
				self.pingUntilPong(onOK, failCounter-1, onFail);
			},500);
		}
	});
}
ChildCom.prototype.clientReciver = function clientReciver(PullResponse){
	console.log('PullResponse:'+PullResponse);
}

ChildCom.prototype.sendCommand = function sendCommand(Command, Value, callback, onComunicationError){
	var self = this;
    var JsonTosend = ToPhantJson({'Command':Command, 'Value': Value});
    var Headers = {'Content-length': JsonTosend.length}
    var req = http.request({hostname:'localhost', headers: Headers, port: self.rpcPort, path:'/to_phantom', method: 'POST', agent: false}, function (res) {
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
                    throw ('the data that the child binary "'+self.binaryFileName+'" returned is not valid JSON. Data:'+ RecivedJson);
                }else{
                    callback(RetDat);
                }
            }else{
                throw ('Answer from the child binary "'+self.binaryFileName+'" contained no returned data');
            }
        });
    })
    req.on('error', onComunicationError || function(e) {
        console.error('Some kind of error when comunicating with the child binary "'+self.binaryFileName+'": ' + e.message);
    });
    req.write(JsonTosend);
    req.end();
}

ChildCom.prototype.execFunc = function execFunc(Func, args, callback){
	var self = this;
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
		throw ("Programing Error: Func needs to be either a function or a public id")
	}
	self.sendCommand('execFunc', FuncDescriptor, function(DataFromServer){
		var RemoteObj = PublicDescriptorToObj(DataFromServer);
		callback(RemoteObj);
	});
}

ChildCom.prototype.startServerPuller = function startServerPuller(AnswerToServer){
	var self = this;
	self.sendCommand('Answer', AnswerToServer, function(DataFromServer){
		var NewAns = null;
		if(typeof(self.clientReciver) == 'function'){
			NewAns = self.clientReciver(DataFromServer);
		}
		//wait a bit with starting a new server pull conection
		setTimeout(function(){
			self.startServerPuller(NewAns);
		}, 1);
	});
}

module.exports = ChildCom;

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


