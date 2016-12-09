import * as utils from "utils/utils";
declare var ro;
var GetJSONIntentService = (<any>android.app.IntentService).extend("ro.acorn.nsbghttp.GetJSONIntentService", {
    onHandleIntent: function (intent: android.content.Intent) {
        console.log("handle intent");
        switch (intent.getAction()) {
            case GetJSONIntentService.ACTIONS.START:
                let request = JSON.parse(intent.getStringExtra("request"));
                let taskId = intent.getStringExtra("taskId");
                this.startHttpReq(request, taskId);
                break;
        }
    },
    startHttpReq: function (request: any, taskId: string) {
        new JSONHttpTask(request, taskId).start();
    }
});

GetJSONIntentService.delegates = {};
GetJSONIntentService.ACTIONS = {
    START: 'ro.acorn.nsbghttp.start',
    STOP: 'nsbghttp.stop',
    PROGRESS_UPDATE: 'nsbghttp.progress',
    STATUS_UPDATE: 'nsbghttp.status'
};
GetJSONIntentService.REQUEST_DATA = 'nsbghttp.requestData';
GetJSONIntentService.setDelegate = function (taskId: string, delegate: JSONStatusDelegate) {
    GetJSONIntentService.delegates[taskId] = delegate;
};
GetJSONIntentService.progressUpdate = function (taskId: string, downloaded: number) {
    let delegate: JSONStatusDelegate = GetJSONIntentService.delegates[taskId];
    if (delegate != null) {
        delegate.onProgress(downloaded);
    }
};
GetJSONIntentService.completeTask = function (taskId: string, response: any) {
    let delegate: JSONStatusDelegate = GetJSONIntentService.delegates[taskId];
    if (delegate != null) {
        delegate.onComplete(response);
    }
};
GetJSONIntentService.taskError = function(taskId: string, err: Error) {
    let delegate: JSONStatusDelegate = GetJSONIntentService.delegates[taskId];
    if (delegate != null) {
        delegate.onError(err);
    }
};

exports.GetJSONIntentService = GetJSONIntentService;
/*
@JavaProxy("ro.acorn.nsbghttp.GetJSONIntentService")
export class GetJSONIntentService extends android.app.IntentService {
    static delegates: java.util.Map<string, JSONStatusDelegate> = new java.util.concurrent.ConcurrentHashMap<string, JSONStatusDelegate>();
    static ACTIONS: any = {
        START: 'ro.acorn.nsbghttp.start',
        STOP: 'nsbghttp.stop',
        PROGRESS_UPDATE: 'nsbghttp.progress',
        STATUS_UPDATE: 'nsbghttp.status'
    };
    static REQUEST_DATA: string = 'nsbghttp.requestData';

    onHandleIntent(intent: android.content.Intent) {
        console.log("handle intent");
        switch (intent.getAction()) {
            case GetJSONIntentService.ACTIONS.START:
                let request = JSON.parse(intent.getStringExtra("request"));
                let taskId = intent.getStringExtra("taskId");
                this.startHttpReq(request, taskId);
                break;
        }    
    }

    static setDelegate(taskId: string, delegate: JSONStatusDelegate) {
        GetJSONIntentService.delegates.put(taskId, delegate);
    }

    static progressUpdate(taskId: string, downloaded: number) {
        let delegate: JSONStatusDelegate = GetJSONIntentService.delegates[taskId];
        if (delegate != null) {
            delegate.onProgress(downloaded);
        }
    }

    static completeTask(taskId: string, response : any) {
        let delegate: JSONStatusDelegate = GetJSONIntentService.delegates[taskId];
        if (delegate != null) {
            delegate.onComplete(response);
        }
    }

    static taskError(taskId: string, err : Error) {
        let delegate: JSONStatusDelegate = GetJSONIntentService.delegates[taskId];
        if (delegate != null) {
            delegate.onError(err);
        }
    }

    private startHttpReq(request: any, taskId : string) {
        new JSONHttpTask(request, taskId).start();
    }
}
*/

export class JSONHttpRequest {
    private request: any;
    private delegate: JSONStatusDelegate;
    private taskId: string;

    constructor(request: any, taskId? : string, handler?: JSONStatusDelegate) {
        this.request = request;
        this.delegate = handler || null;
        this.taskId = taskId || '' + new Date().getTime();
    }

    private getIntent(): android.content.Intent {
        let context: android.content.Context = utils.ad.getApplicationContext();

        let intent: android.content.Intent = new android.content.Intent(context, (<any>ro).acorn.nsbghttp.GetJSONIntentService.class);
        intent.putExtra("taskId", this.taskId);
        try {
            intent.putExtra("request", JSON.stringify(this.request));
        } catch (e) {
            console.log("could not stringify request object");
        }
       // intent.putExtra("content", this.request.content);

        return intent;
    }

    start() {
        
        let intent: android.content.Intent = this.getIntent();
        intent.setAction(GetJSONIntentService.ACTIONS.START);

        if (this.delegate) {
            GetJSONIntentService.setDelegate(this.taskId, this.delegate);
        }
        
        utils.ad.getApplicationContext().startService(intent);
    }
}

export class JSONHttpTask {
    private request: any;
    private taskId: string;
    private downloaded: number = 0;

    constructor(request: any, taskId: string) {
        this.request = request;
        this.taskId = taskId;
    }

    private sendProgressUpdate() {
        GetJSONIntentService.progressUpdate(this.taskId, this.downloaded);
    }

    private sendErrorUpdate(err: Error) {
        GetJSONIntentService.taskError(this.taskId, err);
    }

    private sendCompleteUpdate(response: any) {
        GetJSONIntentService.completeTask(this.taskId, response);
    }

    public start() {
        let request = this.request;

        let params: string = null;
        if (request.queryString) {
            params = "?";

            let paramNames: string[] = Object.keys(request.queryString);

            paramNames.forEach((paramName: string, index: number) => {
                let value: string = request.queryString[paramName];
                if (value !== null && value !== void 0) {
                    params += paramName + "=" + value;
                    if (index < paramNames.length - 1) {
                        params += "&";
                    }
                }
            });

            params = java.net.URLEncoder.encode(params, "UTF-8");
        }
        console.log('params: %s', params);
        let finalUrl: string = request.url;
        if (params) {
            finalUrl += params;
        }
        console.log('final url : %s', finalUrl);
        var urlObject = new java.net.URL(finalUrl);
        var httpConnection = urlObject.openConnection();

        if (request.method === "POST" || request.method === "PUT") {
            httpConnection.setDoOutput(true);
        }
        (<any>httpConnection).setRequestMethod(request.method);



        if (request.headers) {
            for (var header in request.headers) {
                var value = request.headers[header];
                if (value !== null && value !== void 0) {
                    if (Array.isArray(value) && value.length > 0) {
                        value = value[0];
                        try {
                            value = JSON.stringify(value);
                        } catch (e) { }
                    }
                    console.log('setting header %s with value %s', header, value);
                    httpConnection.setRequestProperty(header, value);
                }
            }
        }

        let inStream = httpConnection.getInputStream();

        let buffInStream = new java.io.BufferedInputStream(inStream);

        let readByte: number = null;

        let response = "";

        while (readByte !== -1) {
            readByte = buffInStream.read();
            response += String.fromCharCode(readByte);
            this.downloaded++;
            this.sendProgressUpdate();
        }

        try {
            response = JSON.parse(response as string);
            this.sendCompleteUpdate(response);
        } catch (e) {
            this.sendErrorUpdate(new Error("Server response not in JSON format."));
        }

        console.log("response : %s", response);
    }
    
}

@JavaProxy("ro.acorn.nsbghttp.JSONStatusDelegate")
export class JSONStatusDelegate extends java.lang.Object {
    onProgress(downloaded: number) {
        throw new Error("not implemented");
    }
    onComplete(response : any) {
        throw new Error("not implemented");
    }
    onError(err : Error) {
        throw new Error("not implemented");
    }
}