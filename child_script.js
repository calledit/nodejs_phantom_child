var webserver = require('webserver');
var webPage = require('webpage');


phantom.onError = function(msg, trace) {
  console.error(msg);
  phantom.exit(1);
  return;
};



var OrgThis = this;

var system = require('system');

//console.log(dump(phantom))

var SubmitedThings = [];
var PublicObjects = {'phantom':phantom, 'webPage': webPage};
var PrivateSubObjects = [phantom.document];
/*
var Wrapers = {};

var WraperIds = [
	//webPage.create
];
	//WraperIds.indexOf(webPage.create)
		//return(phantom.libraryPath);
var Wrapers = {
	0:function(opts){
	var page = PublicObjects.webPage.create(opts);
	var HiddenProperties = [
		page.settings,
		page.onInitialized,
		page.onLoadStarted,
		page.onLoadFinished,
		page.onUrlChanged,
		page.onNavigationRequested,
		page.onRepaintRequested,
		page.onResourceRequested,
		page.onResourceReceived,
		page.onResourceError,
		page.onResourceTimeout,
		page.onAlert,
		page.onConsoleMessage,
		page.onClosing,
		page._onPageOpenFinished,
		page.onError,
		page.open,
		page.includeJs,
		page.evaluate,
		page.evaluateAsync,
		page.uploadFile,
		page.onCallback,
		page.onFilePicker,
		page.onConfirm,
		page.onPrompt,
		page.onLongRunningScript
	];
	console.log("Ran wrapper returning:", page);
	return(page);
	}
};
*/
//var PublicObjList = FindPublicStuff(PublicObjects);

var PortArg = system.args[system.args.length-1];
var PortNumber = parseInt(PortArg)
if(!PortNumber){
    console.error('The Last commandline argument need to be a tcp port number that phantomjs should listen to');
    phantom.exit(1);
}

var CurrentClientPullig = false;
var onPullingResponse = false;

function SendMessageToNodejs(Message, callback){
	if(typeof(callback) != 'function'){
		console.error('SendMessageToNodejs second argument most be a calback');
		return;
	}
	if(CurrentClientPullig === false){
		console.error('Can Not send message to nodejs cause we do not currently have a pulling connection.');
	}
	onPullingResponse = callback;
    ResponseData = ToJson(Message);
    CurrentClientPullig.write(ResponseData);
    CurrentClientPullig.close();
	CurrentClientPullig = false;
	
}

var server = webserver.create();
var service = server.listen('127.0.0.1:'+PortNumber, requestHandler);
if(!service){
    console.error('Could Not use tcp listining port.');
    phantom.exit(1);
}

/*page = webPage.create();
console.log(dump(page.open))
console.log(page.open)
console.log(dump(page))
*/
/*page.open('https://facebook.com', function (status) {
    console.log("Facebook is open");
});
*/

function requestHandler(request, response) {
    response.statusCode = 200;
    if(request.url == '/from_phantom'){
        //JSON.stringify()
        
    }else if(request.url == '/to_phantom'){
        
        if(typeof(request.post) == 'undefined'){
            response.statusCode = 500;
			ServerShowError("There was no post data", response)
            return;
        }else{
            var fromNodejs = null;
			var DataIsValid = false;
			try{
				fromNodejs = JSON.parse(request.post)
				DataIsValid = true;
			}catch(e){
				DataIsValid = false;
			}
            
            if(!DataIsValid){
                response.statusCode = 500;
				ServerShowError("There was somthing wrogn with the json data", response)
                return;
            }
            if(typeof(fromNodejs.Value) == 'undefined'){
                response.statusCode = 500;
				ServerShowError("Missing value", response)
                return;
            }
            if(!fromNodejs.Command){
                response.statusCode = 500;
				ServerShowError("Missing command", response)
                return;
            }
/*
            if(fromNodejs.Command == "ListPublic"){
                console.log("nodejs wants ListPublic");
                ResponseData = ToJson(PublicObjList);
                response.write(ResponseData);
                response.close();
                return;
            }
*/
            if(fromNodejs.Command == "Answer"){
				if(CurrentClientPullig !== false){
					ServerShowError("Allready have a pulling conenction", response)
                    return;
				}
				if(onPullingResponse !== false){
					onRespTMP = onPullingResponse;
					onPullingResponse = false;
					onRespTMP(fromNodejs.Value);
				}
				CurrentClientPullig = response
                return;
            }
            if(fromNodejs.Command == "Test"){
                ResponseData = ToJson("TestOk");
                response.write(ResponseData);
                response.close();
				/*setTimeout(function(){
					console.log("Sending pulling message to nodejs");
					SendMessageToNodejs("TEstPulling", function(Ans){
						console.log("Got answer from nodejs to pulling message", Ans);
					});
				}, 2000);*/
                return;
            }
            if(fromNodejs.Command == "Ping"){
                ResponseData = ToJson("Pong");
                response.write(ResponseData);
                response.close();
                return;
            }
			
            if(fromNodejs.Command == "execFunc"){
				var execFunc = false;
				if(typeof(fromNodejs.Value.FuncPublicId) != 'undefined'){
					if(typeof(SubmitedThings[fromNodejs.Value.FuncPublicId]) == 'undefined'){
						response.statusCode = 500;
						ServerShowError("The function nodejs wanted to exec did not exsist", response)
						return;
					}
					execFunc = SubmitedThings[fromNodejs.Value.FuncPublicId];
				}else if(typeof(fromNodejs.Value.FuncText) != 'undefined'){
					try{
						execFunc = eval('('+fromNodejs.Value.FuncText+')');
					}catch(e){
						ServerShowError("The function nodejs wants to exec contains parsing errors");
						return;
					}
				}
				if(typeof(execFunc) != 'function'){
					ServerShowError("The function nodejs wants to exec could not be properly parsed it seams to be of the type:"+typeof(execFunc));
                    return;
				}
                if(typeof(fromNodejs.Value.args) == 'undefined'){
                    response.statusCode = 500;
					ServerShowError("Missing args to exec with", response)
                    return;
                }
				var PrivArgs = [];
				
				var InArgs = fromNodejs.Value.args;
				for(var ArgNum in InArgs){
					if(typeof(InArgs[ArgNum]) == 'object'){
						if(typeof(InArgs[ArgNum]._id) == 'number'){
							if(typeof(SubmitedThings[InArgs[ArgNum]._id]) == 'undefined'){
								response.statusCode = 500;
								ServerShowError("Argument that nodejs wanted to use did not exsist", response)
								return;
							}
							PrivArgs[ArgNum] = SubmitedThings[InArgs[ArgNum]._id];
						}else{
							PrivArgs[ArgNum] = InArgs[ArgNum].obj
						}
					}else{
						PrivArgs[ArgNum] = InArgs[ArgNum];
					}
				}
				var Ret = false;
				try{
					Ret = execFunc.apply(this, PrivArgs);
				}catch(e){
					ServerShowError("The function nodejs wants to exec generated an error.");
                    return;
				}
				var PublicObj = createPublicationObj(Ret);
                ResponseData = ToJson(PublicObj);
                response.write(ResponseData);
                response.close();
                return;
            }
			/*
            if(fromNodejs.Command == "Exec"){
                if(typeof(fromNodejs.Value.what) == 'undefined'){
                    response.statusCode = 500;
					ServerShowError("Missing what to exec", response)
                    return;
                }

                if(typeof(fromNodejs.Value.args) == 'undefined'){
                    response.statusCode = 500;
					ServerShowError("Missing args to exec with", response)
                    return;
                }

				
				if(typeof(SubmitedThings[fromNodejs.Value.what]) == 'undefined'){
                    response.statusCode = 500;
					ServerShowError("The function nodejs wanted to exec did not exsist", response)
                    return;
				}
                //var FindExecThing = [PublicObjects];
                //for(var pos=0;pos<fromNodejs.Value.what.length;pos++){
                  //  console.log('searching: ',pos,' found',fromNodejs.Value.what[pos])
                    //console.log('This: ', webPage)
                    //console.log('This: ', dump(FindExecThing[pos]))
                    //console.log('Does it exist: ', FindExecThing[pos], FindExecThing[pos][fromNodejs.Value.what[pos]])
                    //FindExecThing[pos+1] = FindExecThing[pos][fromNodejs.Value.what[pos]];
                //}
                var FuncToExec = SubmitedThings[fromNodejs.Value.what];
                var thisArg = OrgThis;
                //if(FindExecThing[FindExecThing.length-2]){
                    //var thisArg = FindExecThing[FindExecThing.length-2];
                //}
                console.log("Executing: ", SubmitedThings[fromNodejs.Value.what], "Args: ", fromNodejs.Value.args);
                var ReturnDat = FuncToExec.apply(thisArg, fromNodejs.Value.args);
                if(typeof(ReturnDat) == 'undefined'){
                    ReturnDat = null;
                }else{
					ReturnDat = FindPublicStuff(ReturnDat);
				}
                //console.log("Executed and got: ", ReturnDat);
                
                ResponseData = ToJson(ReturnDat);
                response.write(ResponseData);
                response.close();
                return;
            }
			*/
            response.statusCode = 404;
			ServerShowError("Unknown command", response)
        }
    }else{
        response.statusCode = 404;
        response.write('This is an internal rpc server used to message betwean phantomjs and nodejs.');
        response.close();
    }
}

function ServerShowError(ErrText, response){
	console.error(ErrText);
	response.write(ErrText);
    response.close();
}

function createPublicationObj(FromObj){
	var InType = typeof(FromObj);
	if(InType != 'function' && InType != 'object'){
		return(FromObj);
	}
	var PublicId = SubmitedThings.indexOf(FromObj);
	if(PublicId == -1){
		SubmitedThings.push(FromObj);
		PublicId = SubmitedThings.length-1;
	}
	var PublicationObj = {
		'_id': PublicId,
	};
	PublicationObj.type = InType;
	if(InType != 'function'){
		var PublicCopy = {}
		for(var key in FromObj){//Publizie keys in object
			console.log(key,'=', typeof(FromObj[key]));
			PublicCopy[key] = createPublicationObj(FromObj[key]);
		}
		PublicationObj.obj = PublicCopy;
	}
	return(PublicationObj);
}


function FindPublicStuff(S, cache, cacheInfo, road){
    if(typeof(cache) == 'undefined'){
        cache = [];
        cacheInfo = [];
        road = [];
    }
    var Dp = {};
    for(var key in S){
        road.push(key);
        var roadJoin = road.join('.');
        var idinPrivate = PrivateSubObjects.indexOf(S[key]);
        if(idinPrivate === -1){
            var cacheid = cache.indexOf(S[key]);
            if (cacheid == -1) {
                if(typeof(S[key]) == 'object' && S[key] !== null){//Objects
                    cacheInfo.push([roadJoin]);
                    cache.push(S[key]);
                    var SubPublicObjects = FindPublicStuff(S[key], cache, cacheInfo, road);
                    if(SubPublicObjects !== false){
                        Dp[key] = SubPublicObjects;
                    }
                }else if(typeof(S[key]) === 'function'){//functions/Classes

					//This is to solve a bug with function names in phantomjs
					var FirstBrack = key.indexOf('(')
					if(FirstBrack == -1){
						FirstBrack = key.length;
					}
					FunctionNameAsKey = key.substr(0, FirstBrack);
					
                    var TmDm = FindPublicStuff(S[key], cache, cacheInfo, road);
                    if(TmDm.length){//Has Prototypes and shit
                        Dp[FunctionNameAsKey] = TmDm;
                    }else{
                        Dp[FunctionNameAsKey] = createPublicationObj(S[key]);
                    }
                    /*
                    var TmDm = FindPublicStuff(S[key], cache, cacheInfo, road);
                    var FCont = S[key].toString().replace("\n    [native code]\n", "[native code]")
                    if(TmDm.length == 0){
                        Dp[key] = {};
                        Dp[key][FCont] = TmDm;
                    }else{
                        Dp[key] = FCont;
                    }
                    */
                }else{//Standard Values
                    Dp[key] = createPublicationObj(S, key);
                }
            }else{
                Dp[key] = "Cyclic previosly Found in: " + cacheInfo[cacheid].join(',');
                cacheInfo[cacheid].push(roadJoin);
            }
        }
        road.pop(key);
    }
    return(Dp);
}

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

function ToJson(In){
    return(JSON.stringify(In, null, 4));
}
function dump(In){
    return(JSON.stringify(PreDump(In), null, 4));
}
