/**
 * @class Ext.UpdateManager
 * @extends Ext.util.Observable
 * Provides AJAX-style update for Element object.<br><br>
 * Usage:<br>
 * <pre><code>
 * // Get it from a Ext.Element object
 * var el = Ext.get("foo");
 * var mgr = el.getUpdateManager();
 * mgr.update("http://myserver.com/index.php", "param1=1&amp;param2=2");
 * ...
 * mgr.formUpdate("myFormId", "http://myserver.com/index.php");
 * <br>
 * // or directly (returns the same UpdateManager instance)
 * var mgr = new Ext.UpdateManager("myElementId");
 * mgr.startAutoRefresh(60, "http://myserver.com/index.php");
 * mgr.on("update", myFcnNeedsToKnow);
 * <br>
   // short handed call directly from the element object
   Ext.get("foo").load({
        url: "bar.php",
        scripts:true,
        params: "for=bar",
        text: "Loading Foo..."
   });
 * </code></pre>
 * @constructor
 * Create new UpdateManager directly.
 * @param {String/HTMLElement/Ext.Element} el The element to update
 * @param {Boolean} forceNew (optional) By default the constructor checks to see if the passed element already has an UpdateManager and if it does it returns the same instance. This will skip that check (useful for extending this class).
 */
Ext.UpdateManager = function(el, forceNew){
    el = Ext.get(el);
    if(!forceNew && el.updateManager){
        return el.updateManager;
    }
    /**
     * The Element object
     * @type Ext.Element
     */
    this.el = el;
    /**
     * Cached url to use for refreshes. Overwritten every time update() is called unless "discardUrl" param is set to true.
     * @type String
     */
    this.defaultUrl = null;

    this.addEvents({
        /**
         * @event beforeupdate
         * Fired before an update is made, return false from your handler and the update is cancelled.
         * @param {Ext.Element} el
         * @param {String/Object/Function} url
         * @param {String/Object} params
         */
        "beforeupdate": true,
        /**
         * @event update
         * Fired after successful update is made.
         * @param {Ext.Element} el
         * @param {Object} oResponseObject The response Object
         */
        "update": true,
        /**
         * @event failure
         * Fired on update failure.
         * @param {Ext.Element} el
         * @param {Object} oResponseObject The response Object
         */
        "failure": true
    });
    var d = Ext.UpdateManager.defaults;
    /**
     * Blank page URL to use with SSL file uploads (Defaults to Ext.UpdateManager.defaults.sslBlankUrl or "about:blank").
     * @type String
     */
    this.sslBlankUrl = d.sslBlankUrl;
    /**
     * Whether to append unique parameter on get request to disable caching (Defaults to Ext.UpdateManager.defaults.disableCaching or false).
     * @type Boolean
     */
    this.disableCaching = d.disableCaching;
    /**
     * Text for loading indicator (Defaults to Ext.UpdateManager.defaults.indicatorText or '&lt;div class="loading-indicator"&gt;Loading...&lt;/div&gt;').
     * @type String
     */
    this.indicatorText = d.indicatorText;
    /**
     * Whether to show indicatorText when loading (Defaults to Ext.UpdateManager.defaults.showLoadIndicator or true).
     * @type String
     */
    this.showLoadIndicator = d.showLoadIndicator;
    /**
     * Timeout for requests or form posts in seconds (Defaults to Ext.UpdateManager.defaults.timeout or 30 seconds).
     * @type Number
     */
    this.timeout = d.timeout;

    /**
     * True to process scripts in the output (Defaults to Ext.UpdateManager.defaults.loadScripts (false)).
     * @type Boolean
     */
    this.loadScripts = d.loadScripts;

    /**
     * Transaction object of current executing transaction
     */
    this.transaction = null;

    /**
     * @private
     */
    this.autoRefreshProcId = null;
    /**
     * Delegate for refresh() prebound to "this", use myUpdater.refreshDelegate.createCallback(arg1, arg2) to bind arguments
     * @type Function
     */
    this.refreshDelegate = this.refresh.createDelegate(this);
    /**
     * Delegate for update() prebound to "this", use myUpdater.updateDelegate.createCallback(arg1, arg2) to bind arguments
     * @type Function
     */
    this.updateDelegate = this.update.createDelegate(this);
    /**
     * Delegate for formUpdate() prebound to "this", use myUpdater.formUpdateDelegate.createCallback(arg1, arg2) to bind arguments
     * @type Function
     */
    this.formUpdateDelegate = this.formUpdate.createDelegate(this);
    /**
     * @private
     */
    this.successDelegate = this.processSuccess.createDelegate(this);
    /**
     * @private
     */
    this.failureDelegate = this.processFailure.createDelegate(this);

    if(!this.renderer){
     /**
      * The renderer for this UpdateManager. Defaults to {@link Ext.UpdateManager.BasicRenderer}.
      */
    this.renderer = new Ext.UpdateManager.BasicRenderer();
    }
    
    Ext.UpdateManager.superclass.constructor.call(this);
};

Ext.extend(Ext.UpdateManager, Ext.util.Observable, {
    /**
     * Get the Element this UpdateManager is bound to
     * @return {Ext.Element} The element
     */
    getEl : function(){
        return this.el;
    },
    /**
     * Performs an <b>asynchronous</b> request, updating this element with the response.
     * If params are specified it uses POST, otherwise it uses GET.<br><br>
     * <b>Note:</b> Due to the asynchronous nature of remote server requests, the Element
     * will not have been fully updated when the function returns. To post-process the returned
     * data, use the callback option, or an <b><tt>update</tt></b> event handler.
     * @param {Object} options A config object containing any of the following options:<ul>
     * <li>url : <b>String/Function</b><p class="sub-desc">The URL to request or a function which
     * <i>returns</i> the URL (defaults to the value of {@link Ext.Ajax#url} if not specified).</p></li>
     * <li>method : <b>String</b><p class="sub-desc">The HTTP method to
     * use. Defaults to POST if the <tt>params</tt> argument is present, otherwise GET.</p></li>
     * <li>params : <b>String/Object/Function</b><p class="sub-desc">The
     * parameters to pass to the server (defaults to none). These may be specified as a url-encoded
     * string, or as an object containing properties which represent parameters,
     * or as a function, which returns such an object.</p></li>
     * <li>scripts : <b>Boolean</b><p class="sub-desc">If <tt>true</tt>
     * any &lt;script&gt; tags embedded in the response text will be extracted
     * and executed (defaults to {@link Ext.UpdateManager.defaults#loadScripts}). If this option is specified,
     * the callback will be called <i>after</i> the execution of the scripts.</p></li>
     * <li>callback : <b>Function</b><p class="sub-desc">A function to
     * be called when the response from the server arrives. The following
     * parameters are passed:<ul>
     * <li><b>el</b> : Ext.Element<p class="sub-desc">The Element being updated.</p></li>
     * <li><b>success</b> : Boolean<p class="sub-desc">True for success, false for failure.</p></li>
     * <li><b>response</b> : XMLHttpRequest<p class="sub-desc">The XMLHttpRequest which processed the update.</p></li>
     * <li><b>options</b> : Object<p class="sub-desc">The config object passed to the update call.</p></li></ul>
     * </p></li>
     * <li>scope : <b>Object</b><p class="sub-desc">The scope in which
     * to execute the callback (The callback's <tt>this</tt> reference.) If the
     * <tt>params</tt> argument is a function, this scope is used for that function also.</p></li>
     * <li>discardUrl : <b>Boolean</b><p class="sub-desc">By default, the URL of this request becomes
     * the default URL for this Updater object, and will be subsequently used in {@link #refresh}
     * calls.  To bypass this behavior, pass <tt>discardUrl:true</tt> (defaults to false).</p></li>
     * <li>timeout : <b>Number</b><p class="sub-desc">The number of seconds to wait for a response before
     * timing out (defaults to {@link Ext.UpdateManager.defaults#timeout}).</p></li>
     * <li>text : <b>String</b><p class="sub-desc">The text to use as the innerHTML of the
     * {@link Ext.UpdateManager.defaults#indicatorText} div (defaults to 'Loading...').  To replace the entire div, not
     * just the text, override {@link Ext.UpdateManager.defaults#indicatorText} directly.</p></li>
     * <li>nocache : <b>Boolean</b><p class="sub-desc">Only needed for GET
     * requests, this option causes an extra, auto-generated parameter to be appended to the request
     * to defeat caching (defaults to {@link Ext.UpdateManager.defaults#disableCaching}).</p></li></ul>
     * <p>
     * For example:
<pre><code>
um.update({
    url: "your-url.php",
    params: {param1: "foo", param2: "bar"}, // or a URL encoded string
    callback: yourFunction,
    scope: yourObject, //(optional scope)
    discardUrl: true,
    nocache: true,
    text: "Loading...",
    timeout: 60,
    scripts: false // Save time by avoiding RegExp execution.
});
</code></pre>
     */
    update : function(url, params, callback, discardUrl){
        if(this.fireEvent("beforeupdate", this.el, url, params) !== false){
            var cfg, callerScope;
            if(typeof url == "object"){ // must be config object
                cfg = url;
                url = cfg.url;
                params = params || cfg.params;
                callback = callback || cfg.callback;
                discardUrl = discardUrl || cfg.discardUrl;
                callerScope = cfg.scope;
                if(typeof cfg.nocache != "undefined"){this.disableCaching = cfg.nocache;};
                if(typeof cfg.text != "undefined"){this.indicatorText = '<div class="loading-indicator">'+cfg.text+"</div>";};
                if(typeof cfg.scripts != "undefined"){this.loadScripts = cfg.scripts;};
                if(typeof cfg.timeout != "undefined"){this.timeout = cfg.timeout;};
            }
            this.showLoading();

            if(!discardUrl){
                this.defaultUrl = url;
            }
            if(typeof url == "function"){
                url = url.call(this);
            }

            var o = Ext.apply({}, {
                url : url,
                params: (typeof params == "function" && callerScope) ? params.createDelegate(callerScope) : params,
                success: this.processSuccess,
                failure: this.processFailure,
                scope: this,
                callback: undefined,
                timeout: (this.timeout*1000),
                disableCaching: this.disableCaching,
                argument: {
                    "options": cfg,
                    "url": url,
                    "form": null,
                    "callback": callback,
                    "scope": callerScope || window,
                    "params": params
                }
            }, cfg);

            this.transaction = Ext.Ajax.request(o);
        }
    },

    /**
     * Performs an async form post, updating this element with the response. If the form has the attribute enctype="multipart/form-data", it assumes it's a file upload.
     * Uses this.sslBlankUrl for SSL file uploads to prevent IE security warning.
     * @param {String/HTMLElement} form The form Id or form element
     * @param {String} url (optional) The url to pass the form to. If omitted the action attribute on the form will be used.
     * @param {Boolean} reset (optional) Whether to try to reset the form after the update
     * @param {Function} callback (optional) Callback when transaction is complete - called with signature (oElement, bSuccess, oResponse)
     */
    formUpdate : function(form, url, reset, callback){
        if(this.fireEvent("beforeupdate", this.el, form, url) !== false){
            if(typeof url == "function"){
                url = url.call(this);
            }
            form = Ext.getDom(form)
            this.transaction = Ext.Ajax.request({
                form: form,
                url:url,
                success: this.successDelegate,
                failure: this.failureDelegate,
                timeout: (this.timeout*1000),
                argument: {"url": url, "form": form, "callback": callback, "reset": reset}
            });
            this.showLoading.defer(1, this);
        }
    },

    /**
     * Refresh the element with the last used url or defaultUrl. If there is no url, it returns immediately
     * @param {Function} callback (optional) Callback when transaction is complete - called with signature (oElement, bSuccess)
     */
    refresh : function(callback){
        if(this.defaultUrl == null){
            return;
        }
        this.update(this.defaultUrl, null, callback, true);
    },

    /**
     * Set this element to auto refresh.
     * @param {Number} interval How often to update (in seconds).
     * @param {String/Function} url (optional) The url for this request or a function to call to get the url (Defaults to the last used url)
     * @param {String/Object} params (optional) The parameters to pass as either a url encoded string "&param1=1&param2=2" or as an object {param1: 1, param2: 2}
     * @param {Function} callback (optional) Callback when transaction is complete - called with signature (oElement, bSuccess)
     * @param {Boolean} refreshNow (optional) Whether to execute the refresh now, or wait the interval
     */
    startAutoRefresh : function(interval, url, params, callback, refreshNow){
        if(refreshNow){
            this.update(url || this.defaultUrl, params, callback, true);
        }
        if(this.autoRefreshProcId){
            clearInterval(this.autoRefreshProcId);
        }
        this.autoRefreshProcId = setInterval(this.update.createDelegate(this, [url || this.defaultUrl, params, callback, true]), interval*1000);
    },

    /**
     * Stop auto refresh on this element.
     */
     stopAutoRefresh : function(){
        if(this.autoRefreshProcId){
            clearInterval(this.autoRefreshProcId);
            delete this.autoRefreshProcId;
        }
    },

    isAutoRefreshing : function(){
       return this.autoRefreshProcId ? true : false;
    },
    /**
     * Called to update the element to "Loading" state. Override to perform custom action.
     */
    showLoading : function(){
        if(this.showLoadIndicator){
            this.el.update(this.indicatorText);
        }
    },

    /**
     * @private
     */
    processSuccess : function(response){
        this.transaction = null;
        if(response.argument.form && response.argument.reset){
            try{ // put in try/catch since some older FF releases had problems with this
                response.argument.form.reset();
            }catch(e){}
        }
        if(this.loadScripts){
            this.renderer.render(this.el, response, this,
                this.updateComplete.createDelegate(this, [response]));
        }else{
            this.renderer.render(this.el, response, this);
            this.updateComplete(response);
        }
    },

    updateComplete : function(response){
        this.fireEvent("update", this.el, response);
        if(typeof response.argument.callback == "function"){
            response.argument.callback(this.el, true, response);
        }
    },

    /**
     * @private
     */
    processFailure : function(response){
        this.transaction = null;
        this.fireEvent("failure", this.el, response);
        if(typeof response.argument.callback == "function"){
            response.argument.callback(this.el, false, response);
        }
    },

    /**
     * Set the content renderer for this UpdateManager. See {@link Ext.UpdateManager.BasicRenderer#render} for more details.
     * @param {Object} renderer The object implementing the render() method
     */
    setRenderer : function(renderer){
        this.renderer = renderer;
    },

    getRenderer : function(){
       return this.renderer;
    },

    /**
     * Set the defaultUrl used for updates
     * @param {String/Function} defaultUrl The url or a function to call to get the url
     */
    setDefaultUrl : function(defaultUrl){
        this.defaultUrl = defaultUrl;
    },

    /**
     * Aborts the executing transaction
     */
    abort : function(){
        if(this.transaction){
            Ext.Ajax.abort(this.transaction);
        }
    },

    /**
     * Returns true if an update is in progress
     * @return {Boolean}
     */
    isUpdating : function(){
        if(this.transaction){
            return Ext.Ajax.isLoading(this.transaction);
        }
        return false;
    }
});

/**
 * @class Ext.UpdateManager.defaults
 * The defaults collection enables customizing the default properties of UpdateManager
 */
   Ext.UpdateManager.defaults = {
       /**
         * Timeout for requests or form posts in seconds (Defaults 30 seconds).
         * @type Number
         */
         timeout : 30,
         /**
         * True to process scripts by default (Defaults to false).
         * @type Boolean
         */
        loadScripts : false,
        /**
        * Blank page URL to use with SSL file uploads (Defaults to "javascript:false").
        * @type String
        */
        sslBlankUrl : (Ext.SSL_SECURE_URL || "javascript:false"),
        /**
         * Whether to append a unique parameter on GET requests to disable caching (Defaults to false).
         * @type Boolean
         */
        disableCaching : false,
        /**
         * Whether to show indicatorText when loading (Defaults to true).
         * @type Boolean
         */
        showLoadIndicator : true,
        /**
         * Text for loading indicator (Defaults to '&lt;div class="loading-indicator"&gt;Loading...&lt;/div&gt;').
         * @type String
         */
        indicatorText : '<div class="loading-indicator">Loading...</div>'
   };

/**
 * Static convenience method. This method is deprecated in favor of el.load({url:'foo.php', ...}).
 *Usage:
 * <pre><code>Ext.UpdateManager.updateElement("my-div", "stuff.php");</code></pre>
 * @param {String/HTMLElement/Ext.Element} el The element to update
 * @param {String} url The url
 * @param {String/Object} params (optional) Url encoded param string or an object of name/value pairs
 * @param {Object} options (optional) A config object with any of the UpdateManager properties you want to set - for 
 * example: {disableCaching:true, indicatorText: "Loading data..."}
 * @static
 * @deprecated
 * @member Ext.UpdateManager
 */
Ext.UpdateManager.updateElement = function(el, url, params, options){
    var um = Ext.get(el, true).getUpdateManager();
    Ext.apply(um, options);
    um.update(url, params, options ? options.callback : null);
};
// alias for backwards compat
Ext.UpdateManager.update = Ext.UpdateManager.updateElement;
/**
 * @class Ext.UpdateManager.BasicRenderer
 * Default Content renderer. Updates the elements innerHTML with the responseText.
 */
Ext.UpdateManager.BasicRenderer = function(){};

Ext.UpdateManager.BasicRenderer.prototype = {
    /**
     * This is called when the transaction is completed and it's time to update the element - The BasicRenderer
     * updates the elements innerHTML with the responseText - To perform a custom render (i.e. XML or JSON processing),
     * create an object with a "render(el, response)" method and pass it to setRenderer on the UpdateManager.
     * @param {Ext.Element} el The element being rendered
     * @param {Object} response The XMLHttpRequest object
     * @param {UpdateManager} updateManager The calling update manager
     * @param {Function} callback A callback that will need to be called if loadScripts is true on the UpdateManager
     */
     render : function(el, response, updateManager, callback){
        el.update(response.responseText, updateManager.loadScripts, callback);
    }
};