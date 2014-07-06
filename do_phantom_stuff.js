var child_comunicator = require("./child_comunicator.js");
child_comunicator.clientReciver = function(MessageFromPhantom){
	
	console.log("Got a pulling message from phantom",MessageFromPhantom)
	return("Got the pulling message:"+MessageFromPhantom);
}
//var RemoteService = null
child_comunicator.init("../patched_phantomjs", function(RemoteResult){
	//RemoteService = RemoteResult;
    console.log("Started Child pinged it then established conenction to it.");
	child_comunicator.execFunc(function(){
		var page = webPage.create();
		var HiddenPageFunctions = {
			'settings': page.settings,
			//'onInitialized': page.onInitialized,
			//'onLoadStarted':page.onLoadStarted,
			//'onLoadFinished':page.onLoadFinished,
			//'onUrlChanged':page.onUrlChanged,
			//'onNavigationRequested':page.onNavigationRequested,
			//'onRepaintRequested':page.onRepaintRequested,
			//'onResourceRequested':page.onResourceRequested,
			//'onResourceReceived':page.onResourceReceived,
			//'onResourceError':page.onResourceError,
			//'onResourceTimeout':page.onResourceTimeout,
			//'onAlert':page.onAlert,
			//'onConsoleMessage':page.onConsoleMessage,
			//'onClosing':page.onClosing,
			//'_onPageOpenFinished':page._onPageOpenFinished,
			//'onError':page.onError,
			'open':page.open,
			'includeJs':page.includeJs,
			'evaluate':page.evaluate,
			'evaluateAsync':page.evaluateAsync,
			'uploadFile':page.uploadFile,
			//'onCallback':page.onCallback,
			//'onFilePicker':page.onFilePicker,
			//'onConfirm':page.onConfirm,
			//'onPrompt':page.onPrompt,
			//'onLongRunningScript':page.onLongRunningScript
		};
		return({'page':page, 'HiddenPageFunctions': HiddenPageFunctions});
}, null, function(PageAndHidden){
	console.log('PageAndHidden', PageAndHidden);
});
	
/*
	child_comunicator.execFunc(function(){
		console.log("Show me the stuff", webPage.create);
		return(webPage.create);
	}, null, function(WebCreateFunc){
		console.log("Child has executed and returned the webPage.create function")
		WebCreateFunc(function(RetV){
			console.log("Child has executed WebCreateFunc has returned a webPage object");
			child_comunicator.execFunc(function(pageObj){return(pageObj.open);}, [RetV], function(openpageFunction){
				console.log("This SHould be a reference to the page.open fucntion:", openpageFunction)
			});

		});
	});

*/
/*
    console.log("Sending test command");
	child_comunicator.sendCommand("Test", "Test Message to Phantom", function(answer){
		console.log("Got answer to test command:",answer);
	});
*/

});

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
