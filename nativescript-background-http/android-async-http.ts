export interface HttpStatusDelegate {
    onProgress(downloaded: number);
    onComplete(response: any);
    onError(err: Error);
}

var HttpAsyncTask = (<any>android.os.AsyncTask).extend({
    delegate: null,
    request: null,
    downloaded: 0,
    response: null,
    error: null,

    init: function () {
        console.log("async task constructor");
    },

    setDelegate: function (statusDelegate: HttpStatusDelegate = null) {
        this.delegate = statusDelegate;
        return this;
    },

    setRequest: function (request: any) {
        this.request = request;
        return this;
    },
    onPreExecute() { },

    doInBackground(unused: any) {
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
        //console.log('params: %s', params);
        let finalUrl: string = request.url;
        if (params) {
            finalUrl += params;
        }
        //console.log('final url : %s', finalUrl);
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
                    //console.log('setting header %s with value %s', header, value);
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
            this.response = response;
        } catch (e) {
            this.sendErrorUpdate(new Error("Server response not in JSON format."));
        }

        //console.log("response : %s", response);
    },

    onPostExecute(unused: any) {
        this.sendCompleteUpdate();
    },

    sendProgressUpdate() {
        if (this.delegate) {
            this.delegate.onProgress(this.downloaded);
        }
    },

    sendErrorUpdate(error: Error) {
        if (this.delegate) {
            this.delegate.onError(error);
        }
    },

    sendCompleteUpdate() {
        if (this.response && this.delegate) {
            this.delegate.onComplete(this.response);
        }
    }

});

export { HttpAsyncTask };