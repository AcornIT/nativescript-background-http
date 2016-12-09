import application = require("application");
import frame = require("ui/frame");
import data_observable = require("data/observable");
import utils = require("utils/utils");
import * as JSONIntentService from "./android-intents/getjson-intent";
import { HttpStatusDelegate, HttpAsyncTask } from "./android-async-http";

declare var net;

interface UploadInfo {
    getUploadId(): string;
    getTotalBytes(): number;
    getUploadedBytes(): number;
}
interface ServerResponse {
    getBodyAsString(): string;
}

var ProgressReceiver = (<any>net).gotev.uploadservice.UploadServiceBroadcastReceiver.extend({
    onProgress(uploadInfo: UploadInfo) {
        //console.log("onProgress");
        var uploadId = uploadInfo.getUploadId();
        var task = Task.fromId(uploadId);
        var totalBytes = uploadInfo.getTotalBytes();
        var currentBytes = uploadInfo.getUploadedBytes();
        task.setTotalUpload(totalBytes);
        task.setUpload(currentBytes);
        task.setStatus("uploading");
        task.notify({ eventName: "progress", object: task, currentBytes: currentBytes, totalBytes: totalBytes });
    },

    onCancelled(uploadInfo: UploadInfo) {
        //console.log("onCancelled");
        this.onError(uploadInfo, new Error("Cancelled"));
    },

    onError(uploadInfo: UploadInfo, error) {
        //console.log("onError");
        var uploadId = uploadInfo.getUploadId();
        var task = Task.fromId(uploadId);
        task.setStatus("error");
        task.notify({ eventName: "error", object: task, error: error });
    },

    onCompleted(uploadInfo: UploadInfo, serverResponse: ServerResponse) {
        //console.log("onCompleted");
        var uploadId = uploadInfo.getUploadId();
        var task = Task.fromId(uploadId);

        var totalUpload = uploadInfo.getTotalBytes();
        if (!totalUpload || !isFinite(totalUpload) || totalUpload <= 0) {
            totalUpload = 1;
        }
        task.setUpload(totalUpload);
        task.setTotalUpload(totalUpload);
        task.setStatus("complete");

        task.notify({ eventName: "progress", object: task, currentBytes: totalUpload, totalBytes: totalUpload });
        task.notify({ eventName: "responded", object: task, data: serverResponse.getBodyAsString() });
        task.notify({ eventName: "complete", object: task, response: serverResponse });
   }
});


var receiver;

export function session(id: string) {

    if (!receiver) {
        var context = utils.ad.getApplicationContext();
        receiver = new ProgressReceiver();
        receiver.register(context);
    }

    // TODO: Cache.
    return new Session(id);
}

class ObservableBase extends data_observable.Observable {
    protected notifyPropertyChanged(propertyName: string, value: any): void {
        this.notify({ object: this, eventName: data_observable.Observable.propertyChangeEvent, propertyName: propertyName, value: value });
    }
}

class Session {
    private _id: string;

    constructor(id: string) {
        this._id = id;
    }

    public uploadFile(file: string, options: any): Task {
        return Task.create(this, file, options);
    }

    public getJSON(request: Request): Task {
        return Task.createGetJSON(request);
    }

    public postJSON(reqBody: string, request: Request): Task {
        return null;
    }

    get id(): string {
        return this._id;
    }
}

class Request {

    url: string;

    method: string;

    headers: {};

    queryString: {};

    description: string;

    constructor(url?: string) {
        this.url = url;
    }
}

class JsonTaskDelegate implements HttpStatusDelegate {
    private task: Task;

    constructor(task: Task) {
        this.task = task;
    }

    onProgress(downloaded: number) {
        this.task.downloaded = downloaded;
    }

    onComplete(response: any) {
        this.task._response = response;
        this.task.setStatus("complete");
    }

    onError(err: Error) {
        this.task._error = new Error("Server response not in JSON format.");
        this.task.setStatus("errored");
    }
}

class Task extends ObservableBase {

    private static taskCount = 0;
    private static cache = {};

    private _session;
    private _id;

    private _upload: number;
    private _totalUpload: number;
    private _status: string;
    private _description: string;

    private _downloaded: number;
    private _callback: Function;
    private _errHandler: Function;
    _response: any;
    _error: Error;

    static createGetJSON(request: Request): Task {
        if (!request.url) {
            throw new Error("No request url specified");
        }
        request.method = request.method || "GET";

        let task: Task = new Task();
        task.setDescription(request.description);
        Task.cache[task._id] = task;




        let delegate: JsonTaskDelegate = new JsonTaskDelegate(task);
        let httpAsyncTask = new HttpAsyncTask(this);
        httpAsyncTask.setDelegate(delegate).setRequest(request).execute(null);
        //httpAsyncTask.execute(null);
       // let httpReq: JSONIntentService.JSONHttpRequest = new JSONIntentService.JSONHttpRequest(request, task._id, delegate);
       // httpReq.start();
        //var executorService = java.util.concurrent.Executors.newSingleThreadExecutor();

        /*var asyncTask = (<any>android.os.AsyncTask).extend({
            doInBackground(prm : any) {
               /* let urlParts: string[] = request.url.split(":");
                if (urlParts.length < 2 || urlParts[1].split("//").length < 2) {
                    throw new Error("Invalid url specified. Valid format: <protocol>://hostname[:<port>]");
                }

                let protocol: string = urlParts[0];
                let host: string = urlParts[1].split("//")[1];
                let port: number = null;
                

                if (urlParts.length > 2) {
                    try {
                        port = parseInt(urlParts[urlParts.length - 1]);
                        if (isNaN(port)) {
                            port = null;
                        }
                    } catch (e) { }
                }

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

                task.setDescription(request.description);

                Task.cache[task._id] = task;

                let inStream = httpConnection.getInputStream();

                let buffInStream = new java.io.BufferedInputStream(inStream);

                let readByte: number = null;

                let response = "";

                task.setStatus("pending");

                while (readByte !== -1) {
                    readByte = buffInStream.read();
                    response += String.fromCharCode(readByte);
                    task.downloaded = task.downloaded || 0;
                    task.downloaded++;
                }

                try {
                    response = JSON.parse(response as string);
                    task._response = response;
                    task.setStatus("complete");
                } catch (e) {
                    task._error = new Error("Server response not in JSON format.");
                    task.setStatus("errored");
                }

                console.log("response : %s", response);
            }
        });
        /*
        var runnable = new java.lang.Runnable({
            run() {
                let urlParts: string[] = request.url.split(":");
                if (urlParts.length < 2 || urlParts[1].split("//").length < 2) {
                    throw new Error("Invalid url specified. Valid format: <protocol>://hostname[:<port>]");
                }

                let protocol: string = urlParts[0];
                let host: string = urlParts[1].split("//")[1];
                let port: number = null;
                let params: string = null;

                if (urlParts.length > 2) {
                    try {
                        port = parseInt(urlParts[urlParts.length - 1]);
                        if (isNaN(port)) {
                            port = null;
                        }
                    } catch (e) { }
                }

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
                 
                var urlObject = new java.net.URL(request.url + params);
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
                            httpConnection.setRequestProperty(header, value);
                        }
                    }
                }

                task.setDescription(request.description);

                Task.cache[task._id] = task;

                let inStream = httpConnection.getInputStream();

                let buffInStream = new java.io.BufferedInputStream(inStream);

                let readByte: number = null;

                let response = "";

                task.setStatus("pending");

                while (readByte !== -1) {
                    readByte = buffInStream.read();
                    response += String.fromCharCode(readByte);
                    task.downloaded = task.downloaded || 0;
                    task.downloaded++;
                }

                try {
                    response = JSON.parse(response as string);
                    task._response = response;
                    task.setStatus("complete");
                } catch (e) {
                    task._error = new Error("Server response not in JSON format.");
                    task.setStatus("errored");
                }

                console.log("response : %s", response);
            }
        });

        //executorService.execute(runnable);

        new asyncTask().execute(null);*/
        return task;
    }

    static create(session: Session, file: string, options: any): Task {
        var task = new Task();
        task._session = session;
        task._id = session.id + "{" + ++Task.taskCount + "}";

        var context = application.android.context;

        var request = new (<any>net).gotev.uploadservice.BinaryUploadRequest(context, task._id, options.url);
        
        request.setFileToUpload(file);

        request.setNotificationConfig(new (<any>net).gotev.uploadservice.UploadNotificationConfig());

        var headers = options.headers;
        if (headers) {
            for (var header in headers) {
                var value = headers[header];
                if (value !== null && value !== void 0) {
                    request.addHeader(header, value.toString());
                }
            }
        }

        task.setDescription(options.description);

        request.setMethod(options.method ? options.method : "GET");

        task.setUpload(0);
        task.setTotalUpload(1);
        task.setStatus("pending");

        request.startUpload();

        Task.cache[task._id] = task;

        return task;
    }

    static fromId(id: string): Task {
        return Task.cache[id];
    }

    get upload(): number {
        return this._upload;
    }

    get totalUpload(): number {
        return this._totalUpload;
    }

    get status(): string {
        return this._status;
    }

    get description(): string {
        return this._description;
    }

    get session(): Session {
        return this._session;
    }

    get downloaded(): number {
        return this._downloaded;
    }

    set downloaded(value: number) {
        this._downloaded = value;
        this.notify({ eventName: "progress", object: this, downloaded: value })
    }

    public then(callback: Function) {
        this._callback = callback;
        return this;
    }

    public catch(callback: Function) {
        this._errHandler = callback;
        return this;
    }

    setTotalUpload(value: number) {
        this._totalUpload = value;
        this.notifyPropertyChanged("totalUpload", value);
    }

    setUpload(value: number) {
        this._upload = value;
        this.notifyPropertyChanged("upload", value);
    }

    setStatus(value: string) {
        this._status = value;
        if (this._status === "complete") {
            if (this._callback) {
                this._callback(this._response);
            }
            this.notify({ eventName: "complete", object: this, response: this._response });
        } else if (this._status === "errored") {
            if (this._errHandler) {
                this._errHandler(this._error);
            }
            this.notify({ eventName: "error", object: this, response: this._error});
        }
        this.notifyPropertyChanged("status", value);
    }

    setDescription(value: string) {
        this._description = value;
        this.notifyPropertyChanged("description", value);
    }

}



