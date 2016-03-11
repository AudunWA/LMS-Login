(function(j) {
    typeof define === "function" && define.amd ? define(["jquery", "jquery.ui.widget"], j) : j(window.jQuery)
})(function(j) {
    j.support.xhrFileUpload = !!(window.XMLHttpRequestUpload && window.FileReader);
    j.support.xhrFormDataFileUpload = !!window.FormData;
    j.propHooks.elements = {
        get: function(f) {
            if (j.nodeName(f, "form")) return j.grep(f.elements, function(h) {
                return !j.nodeName(h, "input") || h.type !== "file"
            });
            return null
        }
    };
    j.widget("blueimp.fileupload", {
        options: {
            dropZone: j(document),
            pasteZone: j(document),
            fileInput: undefined,
            replaceFileInput: true,
            paramName: undefined,
            singleFileUploads: true,
            limitMultiFileUploads: undefined,
            sequentialUploads: false,
            limitConcurrentUploads: undefined,
            forceIframeTransport: false,
            redirect: undefined,
            redirectParamName: undefined,
            postMessage: undefined,
            multipart: true,
            maxChunkSize: undefined,
            uploadedBytes: undefined,
            recalculateProgress: true,
            progressInterval: 100,
            bitrateInterval: 500,
            formData: function(f) {
                return f.serializeArray()
            },
            add: function(f, h) {
                h.submit()
            },
            processData: false,
            contentType: false,
            cache: false
        },
        _refreshOptionsList: ["fileInput", "dropZone", "pasteZone", "multipart", "forceIframeTransport"],
        _BitrateTimer: function() {
            this.timestamp = +new Date;
            this.bitrate = this.loaded = 0;
            this.getBitrate = function(f, h, b) {
                var c = f - this.timestamp;
                if (!this.bitrate || !b || c > b) {
                    this.bitrate = (h - this.loaded) * (1E3 / c) * 8;
                    this.loaded = h;
                    this.timestamp = f
                }
                return this.bitrate
            }
        },
        _isXHRUpload: function(f) {
            return !f.forceIframeTransport && (!f.multipart && j.support.xhrFileUpload || j.support.xhrFormDataFileUpload)
        },
        _getFormData: function(f) {
            var h;
            if (typeof f.formData === "function") return f.formData(f.form);
            if (j.isArray(f.formData)) return f.formData;
            if (f.formData) {
                h = [];
                j.each(f.formData, function(b, c) {
                    h.push({
                        name: b,
                        value: c
                    })
                });
                return h
            }
            return []
        },
        _getTotal: function(f) {
            var h = 0;
            j.each(f, function(b, c) {
                h += c.size || 1
            });
            return h
        },
        _onProgress: function(f, h) {
            if (f.lengthComputable) {
                var b = +new Date,
                    c, d;
                if (!(h._time && h.progressInterval && b - h._time < h.progressInterval && f.loaded !== f.total)) {
                    h._time = b;
                    c = h.total || this._getTotal(h.files);
                    d = parseInt(f.loaded / f.total *
                        (h.chunkSize || c), 10) + (h.uploadedBytes || 0);
                    this._loaded += d - (h.loaded || h.uploadedBytes || 0);
                    h.lengthComputable = true;
                    h.loaded = d;
                    h.total = c;
                    h.bitrate = h._bitrateTimer.getBitrate(b, d, h.bitrateInterval);
                    this._trigger("progress", f, h);
                    this._trigger("progressall", f, {
                        lengthComputable: true,
                        loaded: this._loaded,
                        total: this._total,
                        bitrate: this._bitrateTimer.getBitrate(b, this._loaded, h.bitrateInterval)
                    })
                }
            }
        },
        _initProgressListener: function(f) {
            var h = this,
                b = f.xhr ? f.xhr() : j.ajaxSettings.xhr();
            if (b.upload) {
                j(b.upload).bind("progress",
                    function(c) {
                        var d = c.originalEvent;
                        c.lengthComputable = d.lengthComputable;
                        c.loaded = d.loaded;
                        c.total = d.total;
                        h._onProgress(c, f)
                    });
                f.xhr = function() {
                    return b
                }
            }
        },
        _initXHRData: function(f) {
            var h, b = f.files[0],
                c = f.multipart || !j.support.xhrFileUpload,
                d = f.paramName[0];
            f.headers = f.headers || {};
            if (f.contentRange) f.headers["Content-Range"] = f.contentRange;
            if (c) {
                if (j.support.xhrFormDataFileUpload) {
                    if (f.postMessage) {
                        h = this._getFormData(f);
                        f.blob ? h.push({
                            name: d,
                            value: f.blob
                        }) : j.each(f.files, function(a, e) {
                            h.push({
                                name: f.paramName[a] ||
                                    d,
                                value: e
                            })
                        })
                    } else {
                        if (f.formData instanceof FormData) h = f.formData;
                        else {
                            h = new FormData;
                            j.each(this._getFormData(f), function(a, e) {
                                h.append(e.name, e.value)
                            })
                        } if (f.blob) {
                            f.headers["Content-Disposition"] = 'attachment; filename="' + encodeURI(b.name) + '"';
                            h.append(d, f.blob, b.name)
                        } else j.each(f.files, function(a, e) {
                            if (window.Blob && e instanceof Blob || window.File && e instanceof File) h.append(f.paramName[a] || d, e, e.name)
                        })
                    }
                    f.data = h
                }
            } else {
                f.headers["Content-Disposition"] = 'attachment; filename="' + encodeURI(b.name) +
                    '"';
                f.contentType = b.type;
                f.data = f.blob || b
            }
            f.blob = null
        },
        _initIframeSettings: function(f) {
            f.dataType = "iframe " + (f.dataType || "");
            f.formData = this._getFormData(f);
            if (f.redirect && j("<a></a>").prop("href", f.url).prop("host") !== location.host) f.formData.push({
                name: f.redirectParamName || "redirect",
                value: f.redirect
            })
        },
        _initDataSettings: function(f) {
            if (this._isXHRUpload(f)) {
                if (!this._chunkedUpload(f, true)) {
                    f.data || this._initXHRData(f);
                    this._initProgressListener(f)
                }
                if (f.postMessage) f.dataType = "postmessage " + (f.dataType ||
                    "")
            } else this._initIframeSettings(f, "iframe")
        },
        _getParamName: function(f) {
            var h = j(f.fileInput),
                b = f.paramName;
            if (b) j.isArray(b) || (b = [b]);
            else {
                b = [];
                h.each(function() {
                    var c = j(this),
                        d = c.prop("name") || "files[]";
                    for (c = (c.prop("files") || [1]).length; c;) {
                        b.push(d);
                        c -= 1
                    }
                });
                b.length || (b = [h.prop("name") || "files[]"])
            }
            return b
        },
        _initFormSettings: function(f) {
            if (!f.form || !f.form.length) {
                f.form = j(f.fileInput.prop("form"));
                if (!f.form.length) f.form = j(this.options.fileInput.prop("form"))
            }
            f.paramName = this._getParamName(f);
            if (!f.url) f.url = f.form.prop("action") || location.href;
            f.type = (f.type || f.form.prop("method") || "").toUpperCase();
            if (f.type !== "POST" && f.type !== "PUT" && f.type !== "PATCH") f.type = "POST";
            if (!f.formAcceptCharset) f.formAcceptCharset = f.form.attr("accept-charset")
        },
        _getAJAXSettings: function(f) {
            f = j.extend({}, this.options, f);
            this._initFormSettings(f);
            this._initDataSettings(f);
            return f
        },
        _enhancePromise: function(f) {
            f.success = f.done;
            f.error = f.fail;
            f.complete = f.always;
            return f
        },
        _getXHRPromise: function(f, h, b) {
            var c = j.Deferred(),
                d = c.promise();
            h = h || this.options.context || d;
            if (f === true) c.resolveWith(h, b);
            else f === false && c.rejectWith(h, b);
            d.abort = c.promise;
            return this._enhancePromise(d)
        },
        _getUploadedBytes: function(f) {
            return (f = (f = (f = f.getResponseHeader("Range")) && f.split("-")) && f.length > 1 && parseInt(f[1], 10)) && f + 1
        },
        _chunkedUpload: function(f, h) {
            var b = this,
                c = f.files[0],
                d = c.size,
                a = f.uploadedBytes = f.uploadedBytes || 0,
                e = f.maxChunkSize || d,
                g = c.slice || c.webkitSlice || c.mozSlice,
                k = j.Deferred(),
                l = k.promise(),
                o, n;
            if (!(this._isXHRUpload(f) &&
                g && (a || e < d)) || f.data) return false;
            if (h) return true;
            if (a >= d) {
                c.error = "Uploaded bytes exceed file size";
                return this._getXHRPromise(false, f.context, [null, "error", c.error])
            }
            n = function() {
                var m = j.extend({}, f);
                m.blob = g.call(c, a, a + e, c.type);
                m.chunkSize = m.blob.size;
                m.contentRange = "bytes " + a + "-" + (a + m.chunkSize - 1) + "/" + d;
                b._initXHRData(m);
                b._initProgressListener(m);
                o = (b._trigger("chunksend", null, m) !== false && j.ajax(m) || b._getXHRPromise(false, m.context)).done(function(p, r, B) {
                    a = b._getUploadedBytes(B) || a + m.chunkSize;
                    if (!m.loaded || m.loaded < m.total) b._onProgress(j.Event("progress", {
                        lengthComputable: true,
                        loaded: a - m.uploadedBytes,
                        total: a - m.uploadedBytes
                    }), m);
                    f.uploadedBytes = m.uploadedBytes = a;
                    m.result = p;
                    m.textStatus = r;
                    m.jqXHR = B;
                    b._trigger("chunkdone", null, m);
                    b._trigger("chunkalways", null, m);
                    a < d ? n() : k.resolveWith(m.context, [p, r, B])
                }).fail(function(p, r, B) {
                    m.jqXHR = p;
                    m.textStatus = r;
                    m.errorThrown = B;
                    b._trigger("chunkfail", null, m);
                    b._trigger("chunkalways", null, m);
                    k.rejectWith(m.context, [p, r, B])
                })
            };
            this._enhancePromise(l);
            l.abort = function() {
                return o.abort()
            };
            n();
            return l
        },
        _beforeSend: function(f, h) {
            if (this._active === 0) {
                this._trigger("start");
                this._bitrateTimer = new this._BitrateTimer
            }
            this._active += 1;
            this._loaded += h.uploadedBytes || 0;
            this._total += this._getTotal(h.files)
        },
        _onDone: function(f, h, b, c) {
            if (!this._isXHRUpload(c) || !c.loaded || c.loaded < c.total) {
                var d = this._getTotal(c.files) || 1;
                this._onProgress(j.Event("progress", {
                    lengthComputable: true,
                    loaded: d,
                    total: d
                }), c)
            }
            c.result = f;
            c.textStatus = h;
            c.jqXHR = b;
            this._trigger("done",
                null, c)
        },
        _onFail: function(f, h, b, c) {
            c.jqXHR = f;
            c.textStatus = h;
            c.errorThrown = b;
            this._trigger("fail", null, c);
            if (c.recalculateProgress) {
                this._loaded -= c.loaded || c.uploadedBytes || 0;
                this._total -= c.total || this._getTotal(c.files)
            }
        },
        _onAlways: function(f, h, b, c) {
            this._active -= 1;
            this._trigger("always", null, c);
            if (this._active === 0) {
                this._trigger("stop");
                this._loaded = this._total = 0;
                this._bitrateTimer = null
            }
        },
        _onSend: function(f, h) {
            var b = this,
                c, d, a, e, g = b._getAJAXSettings(h),
                k = function() {
                    b._sending += 1;
                    g._bitrateTimer =
                        new b._BitrateTimer;
                    return c = c || ((d || b._trigger("send", f, g) === false) && b._getXHRPromise(false, g.context, d) || b._chunkedUpload(g) || j.ajax(g)).done(function(l, o, n) {
                        !b._isXHRUpload(g) && typeof l === "undefined" ? b._onFail(n, "error", "Unknown", g) : b._onDone(l, o, n, g)
                    }).fail(function(l, o, n) {
                        b._onFail(l, o, n, g)
                    }).always(function(l, o, n) {
                        b._sending -= 1;
                        b._onAlways(l, o, n, g);
                        if (g.limitConcurrentUploads && g.limitConcurrentUploads > b._sending)
                            for (l = b._slots.shift(); l;) {
                                if (l.state ? l.state() === "pending" : !l.isRejected()) {
                                    l.resolve();
                                    break
                                }
                                l = b._slots.shift()
                            }
                    })
                };
            this._beforeSend(f, g);
            if (this.options.sequentialUploads || this.options.limitConcurrentUploads && this.options.limitConcurrentUploads <= this._sending) {
                if (this.options.limitConcurrentUploads > 1) {
                    a = j.Deferred();
                    this._slots.push(a);
                    e = a.pipe(k)
                } else e = this._sequence = this._sequence.pipe(k, k);
                e.abort = function() {
                    d = [undefined, "abort", "abort"];
                    if (!c) {
                        a && a.rejectWith(g.context, d);
                        return k()
                    }
                    return c.abort()
                };
                return this._enhancePromise(e)
            }
            return k()
        },
        _onAdd: function(f, h) {
            var b = this,
                c =
                true,
                d = j.extend({}, this.options, h),
                a = d.limitMultiFileUploads,
                e = this._getParamName(d),
                g, k, l;
            if (!(d.singleFileUploads || a) || !this._isXHRUpload(d)) {
                k = [h.files];
                g = [e]
            } else if (!d.singleFileUploads && a) {
                k = [];
                g = [];
                for (l = 0; l < h.files.length; l += a) {
                    k.push(h.files.slice(l, l + a));
                    d = e.slice(l, l + a);
                    d.length || (d = e);
                    g.push(d)
                }
            } else g = e;
            h.originalFiles = h.files;
            j.each(k || h.files, function(o, n) {
                var m = j.extend({}, h);
                m.files = k ? n : [n];
                m.paramName = g[o];
                m.submit = function() {
                    return m.jqXHR = this.jqXHR = b._trigger("submit", f, this) !==
                        false && b._onSend(f, this)
                };
                return c = b._trigger("add", f, m)
            });
            return c
        },
        _replaceFileInput: function(f) {
            var h = f.clone(true);
            j("<form></form>").append(h)[0].reset();
            f.after(h).detach();
            j.cleanData(f.unbind("remove"));
            this.options.fileInput = this.options.fileInput.map(function(b, c) {
                if (c === f[0]) return h[0];
                return c
            });
            if (f[0] === this.element[0]) this.element = h
        },
        _handleFileTreeEntry: function(f, h) {
            var b = this,
                c = j.Deferred(),
                d = function(e) {
                    if (e && !e.entry) e.entry = f;
                    c.resolve([e])
                },
                a;
            h = h || "";
            if (f.isFile)
                if (f._file) {
                    f._file.relativePath =
                        h;
                    c.resolve(f._file)
                } else f.file(function(e) {
                    e.relativePath = h;
                    c.resolve(e)
                }, d);
            else if (f.isDirectory) {
                a = f.createReader();
                a.readEntries(function(e) {
                    b._handleFileTreeEntries(e, h + f.name + "/").done(function(g) {
                        c.resolve(g)
                    }).fail(d)
                }, d)
            } else c.resolve([]);
            return c.promise()
        },
        _handleFileTreeEntries: function(f, h) {
            var b = this;
            return j.when.apply(j, j.map(f, function(c) {
                return b._handleFileTreeEntry(c, h)
            })).pipe(function() {
                return Array.prototype.concat.apply([], arguments)
            })
        },
        _getDroppedFiles: function(f) {
            f = f || {};
            var h = f.items;
            if (h && h.length && (h[0].webkitGetAsEntry || h[0].getAsEntry)) return this._handleFileTreeEntries(j.map(h, function(b) {
                var c;
                if (b.webkitGetAsEntry) {
                    if (c = b.webkitGetAsEntry()) c._file = b.getAsFile();
                    return c
                }
                return b.getAsEntry()
            }));
            return j.Deferred().resolve(j.makeArray(f.files)).promise()
        },
        _getSingleFileInputFiles: function(f) {
            f = j(f);
            var h = f.prop("webkitEntries") || f.prop("entries");
            if (h && h.length) return this._handleFileTreeEntries(h);
            h = j.makeArray(f.prop("files"));
            if (h.length) h[0].name ===
                undefined && h[0].fileName && j.each(h, function(b, c) {
                    c.name = c.fileName;
                    c.size = c.fileSize
                });
            else {
                f = f.prop("value");
                if (!f) return j.Deferred().resolve([]).promise();
                h = [{
                    name: f.replace(/^.*\\/, "")
                }]
            }
            return j.Deferred().resolve(h).promise()
        },
        _getFileInputFiles: function(f) {
            if (!(f instanceof j) || f.length === 1) return this._getSingleFileInputFiles(f);
            return j.when.apply(j, j.map(f, this._getSingleFileInputFiles)).pipe(function() {
                return Array.prototype.concat.apply([], arguments)
            })
        },
        _onChange: function(f) {
            var h = this,
                b = {
                    fileInput: j(f.target),
                    form: j(f.target.form)
                };
            this._getFileInputFiles(b.fileInput).always(function(c) {
                b.files = c;
                h.options.replaceFileInput && h._replaceFileInput(b.fileInput);
                h._trigger("change", f, b) !== false && h._onAdd(f, b)
            })
        },
        _onPaste: function(f) {
            var h = f.originalEvent.clipboardData,
                b = {
                    files: []
                };
            j.each(h && h.items || [], function(c, d) {
                var a = d.getAsFile && d.getAsFile();
                a && b.files.push(a)
            });
            if (this._trigger("paste", f, b) === false || this._onAdd(f, b) === false) return false
        },
        _onDrop: function(f) {
            var h = this,
                b = f.dataTransfer =
                f.originalEvent.dataTransfer,
                c = {};
            b && b.files && b.files.length && f.preventDefault();
            this._getDroppedFiles(b).always(function(d) {
                c.files = d;
                h._trigger("drop", f, c) !== false && h._onAdd(f, c)
            })
        },
        _onDragOver: function(f) {
            var h = f.dataTransfer = f.originalEvent.dataTransfer;
            if (this._trigger("dragover", f) === false) return false;
            if (h && j.inArray("Files", h.types) !== -1) {
                h.dropEffect = "copy";
                f.preventDefault()
            }
        },
        _initEventHandlers: function() {
            if (this._isXHRUpload(this.options)) {
                this._on(this.options.dropZone, {
                    dragover: this._onDragOver,
                    drop: this._onDrop
                });
                this._on(this.options.pasteZone, {
                    paste: this._onPaste
                })
            }
            this._on(this.options.fileInput, {
                change: this._onChange
            })
        },
        _destroyEventHandlers: function() {
            this._off(this.options.dropZone, "dragover drop");
            this._off(this.options.pasteZone, "paste");
            this._off(this.options.fileInput, "change")
        },
        _setOption: function(f, h) {
            var b = j.inArray(f, this._refreshOptionsList) !== -1;
            b && this._destroyEventHandlers();
            this._super(f, h);
            if (b) {
                this._initSpecialOptions();
                this._initEventHandlers()
            }
        },
        _initSpecialOptions: function() {
            var f =
                this.options;
            if (f.fileInput === undefined) f.fileInput = this.element.is('input[type="file"]') ? this.element : this.element.find('input[type="file"]');
            else if (!(f.fileInput instanceof j)) f.fileInput = j(f.fileInput);
            if (!(f.dropZone instanceof j)) f.dropZone = j(f.dropZone);
            if (!(f.pasteZone instanceof j)) f.pasteZone = j(f.pasteZone)
        },
        _create: function() {
            var f = this.options;
            j.extend(f, j(this.element[0].cloneNode(false)).data());
            f.blueimpFileupload = null;
            f.fileupload = null;
            this._initSpecialOptions();
            this._slots = [];
            this._sequence =
                this._getXHRPromise(true);
            this._sending = this._active = this._loaded = this._total = 0;
            this._initEventHandlers()
        },
        _destroy: function() {
            this._destroyEventHandlers()
        },
        add: function(f) {
            var h = this;
            if (!(!f || this.options.disabled))
                if (f.fileInput && !f.files) this._getFileInputFiles(f.fileInput).always(function(b) {
                    f.files = b;
                    h._onAdd(null, f)
                });
                else {
                    f.files = j.makeArray(f.files);
                    this._onAdd(null, f)
                }
        },
        send: function(f) {
            if (f && !this.options.disabled) {
                if (f.fileInput && !f.files) {
                    var h = this,
                        b = j.Deferred(),
                        c = b.promise(),
                        d, a;
                    c.abort =
                        function() {
                            a = true;
                            if (d) return d.abort();
                            b.reject(null, "abort", "abort");
                            return c
                        };
                    this._getFileInputFiles(f.fileInput).always(function(e) {
                        if (!a) {
                            f.files = e;
                            d = h._onSend(null, f).then(function(g, k, l) {
                                b.resolve(g, k, l)
                            }, function(g, k, l) {
                                b.reject(g, k, l)
                            })
                        }
                    });
                    return this._enhancePromise(c)
                }
                f.files = j.makeArray(f.files);
                if (f.files.length) return this._onSend(null, f)
            }
            return this._getXHRPromise(false, f && f.context)
        }
    })
});
(function(j) {
    var f = j.HTMLCanvasElement && j.HTMLCanvasElement.prototype,
        h;
    if (h = j.Blob) try {
        h = Boolean(new Blob)
    } catch (b) {
        h = false
    }
    var c = h;
    if (h = c) {
        if (h = j.Uint8Array) try {
            h = (new Blob([new Uint8Array(100)])).size === 100
        } catch (d) {
            h = false
        }
        h = h
    }
    var a = h,
        e = j.BlobBuilder || j.WebKitBlobBuilder || j.MozBlobBuilder || j.MSBlobBuilder,
        g = (c || e) && j.atob && j.ArrayBuffer && j.Uint8Array && function(k) {
            var l, o, n, m, p, r;
            k.split(",")[0].indexOf("base64") >= 0 ? l = atob(k.split(",")[1]) : l = decodeURIComponent(k.split(",")[1]);
            o = new ArrayBuffer(l.length);
            n = new Uint8Array(o);
            for (m = 0; m < l.length; m += 1) n[m] = l.charCodeAt(m);
            return p = k.split(",")[0].split(":")[1].split(";")[0], c ? new Blob([a ? n : o], {
                type: p
            }) : (r = new e, r.append(o), r.getBlob(p))
        };
    j.HTMLCanvasElement && !f.toBlob && (f.mozGetAsFile ? f.toBlob = function(k, l, o) {
        o && f.toDataURL && g ? k(g(this.toDataURL(l, o))) : k(this.mozGetAsFile("blob", l))
    } : f.toDataURL && g && (f.toBlob = function(k, l, o) {
        k(g(this.toDataURL(l, o)))
    }));
    typeof define == "function" && define.amd ? define(function() {
        return g
    }) : j.dataURLtoBlob = g
})(this);
(function(j) {
    typeof define === "function" && define.amd ? define(["jquery", "load-image", "canvas-to-blob", "./jquery.fileupload"], j) : j(window.jQuery, window.loadImage)
})(function(j, f) {
    j.widget("blueimp.fileupload", j.blueimp.fileupload, {
        options: {
            process: [],
            add: function(h, b) {
                j(this).fileupload("process", b).done(function() {
                    b.submit()
                })
            }
        },
        processActions: {
            load: function(h, b) {
                var c = this,
                    d = h.files[h.index],
                    a = j.Deferred();
                window.HTMLCanvasElement && window.HTMLCanvasElement.prototype.toBlob && (j.type(b.maxFileSize) !==
                    "number" || d.size < b.maxFileSize) && (!b.fileTypes || b.fileTypes.test(d.type)) ? f(d, function(e) {
                    if (!e.src) return a.rejectWith(c, [h]);
                    h.img = e;
                    a.resolveWith(c, [h])
                }) : a.rejectWith(c, [h]);
                return a.promise()
            },
            resize: function(h, b) {
                var c = h.img,
                    d;
                b = j.extend({
                    canvas: true
                }, b);
                if (c) {
                    d = f.scale(c, b);
                    if (d.width !== c.width || d.height !== c.height) h.canvas = d
                }
                return h
            },
            save: function(h) {
                if (!h.canvas) return h;
                var b = this,
                    c = h.files[h.index],
                    d = c.name,
                    a = j.Deferred(),
                    e = function(g) {
                        if (!g.name)
                            if (c.type === g.type) g.name = c.name;
                            else if (c.name) g.name =
                            c.name.replace(/\..+$/, "." + g.type.substr(6));
                        h.files[h.index] = g;
                        a.resolveWith(b, [h])
                    };
                h.canvas.mozGetAsFile ? e(h.canvas.mozGetAsFile(/^image\/(jpeg|png)$/.test(c.type) && d || (d && d.replace(/\..+$/, "") || "blob") + ".png", c.type)) : h.canvas.toBlob(e, c.type);
                return a.promise()
            }
        },
        _processFile: function(h, b, c) {
            var d = this,
                a = j.Deferred().resolveWith(d, [{
                    files: h,
                    index: b
                }]).promise();
            d._processing += 1;
            j.each(c.process, function(e, g) {
                a = a.pipe(function(k) {
                    return d.processActions[g.action].call(this, k, g)
                })
            });
            a.always(function() {
                d._processing -=
                    1;
                d._processing === 0 && d.element.removeClass("fileupload-processing")
            });
            d._processing === 1 && d.element.addClass("fileupload-processing");
            return a
        },
        process: function(h) {
            var b = this,
                c = j.extend({}, this.options, h);
            c.process && c.process.length && this._isXHRUpload(c) && j.each(h.files, function(d) {
                b._processingQueue = b._processingQueue.pipe(function() {
                    var a = j.Deferred();
                    b._processFile(h.files, d, c).always(function() {
                        a.resolveWith(b)
                    });
                    return a.promise()
                })
            });
            return this._processingQueue
        },
        _create: function() {
            this._super();
            this._processing = 0;
            this._processingQueue = j.Deferred().resolveWith(this).promise()
        }
    })
});
(function(j) {
    typeof define === "function" && define.amd ? define(["jquery"], j) : j(window.jQuery)
})(function(j) {
    var f = 0;
    j.ajaxTransport("iframe", function(h) {
        if (h.async) {
            var b = h.initialIframeSrc || "javascript:false;",
                c, d, a;
            return {
                send: function(e, g) {
                    c = j('<form style="display:none;"></form>');
                    c.attr("accept-charset", h.formAcceptCharset);
                    a = /\?/.test(h.url) ? "&" : "?";
                    if (h.type === "DELETE") {
                        h.url = h.url + a + "_method=DELETE";
                        h.type = "POST"
                    } else if (h.type === "PUT") {
                        h.url = h.url + a + "_method=PUT";
                        h.type = "POST"
                    } else if (h.type ===
                        "PATCH") {
                        h.url = h.url + a + "_method=PATCH";
                        h.type = "POST"
                    }
                    f += 1;
                    d = j('<iframe src="' + b + '" name="iframe-transport-' + f + '"></iframe>').bind("load", function() {
                        var k, l = j.isArray(h.paramName) ? h.paramName : [h.paramName];
                        d.unbind("load").bind("load", function() {
                            var o;
                            try {
                                o = d.contents();
                                if (!o.length || !o[0].firstChild) throw Error();
                            } catch (n) {
                                o = undefined
                            }
                            g(200, "success", {
                                iframe: o
                            });
                            j('<iframe src="' + b + '"></iframe>').appendTo(c);
                            window.setTimeout(function() {
                                c.remove()
                            }, 0)
                        });
                        c.prop("target", d.prop("name")).prop("action",
                            h.url).prop("method", h.type);
                        h.formData && j.each(h.formData, function(o, n) {
                            j('<input type="hidden"/>').prop("name", n.name).val(n.value).appendTo(c)
                        });
                        if (h.fileInput && h.fileInput.length && h.type === "POST") {
                            k = h.fileInput.clone();
                            h.fileInput.after(function(o) {
                                return k[o]
                            });
                            h.paramName && h.fileInput.each(function(o) {
                                j(this).prop("name", l[o] || h.paramName)
                            });
                            c.append(h.fileInput).prop("enctype", "multipart/form-data").prop("encoding", "multipart/form-data");
                            h.fileInput.removeAttr("form")
                        }
                        c.submit();
                        k && k.length &&
                            h.fileInput.each(function(o, n) {
                                var m = j(k[o]);
                                j(n).prop("name", m.prop("name")).attr("form", m.attr("form"));
                                m.replaceWith(n)
                            })
                    });
                    c.append(d).appendTo(document.body)
                },
                abort: function() {
                    d && d.unbind("load").prop("src", b);
                    c && c.remove()
                }
            }
        }
    });
    j.ajaxSetup({
        converters: {
            "iframe text": function(h) {
                return h && j(h[0].body).text()
            },
            "iframe json": function(h) {
                return h && j.parseJSON(j(h[0].body).text())
            },
            "iframe html": function(h) {
                return h && j(h[0].body).html()
            },
            "iframe xml": function(h) {
                return (h = h && h[0]) && j.isXMLDoc(h) ?
                    h : j.parseXML(h.XMLDocument && h.XMLDocument.xml || j(h.body).html())
            },
            "iframe script": function(h) {
                return h && j.globalEval(j(h[0].body).text())
            }
        }
    })
});
(function(j) {
    var f = function(b, c, d) {
            var a = document.createElement("img"),
                e, g;
            return a.onerror = c, a.onload = function() {
                g && (!d || !d.noRevoke) && f.revokeObjectURL(g);
                c(f.scale(a, d))
            }, window.Blob && b instanceof Blob || window.File && b instanceof File ? (e = g = f.createObjectURL(b), a._type = b.type) : e = b, e ? (a.src = e, a) : f.readFile(b, function(k) {
                var l = k.target;
                l && l.result ? a.src = l.result : c(k)
            })
        },
        h = window.createObjectURL && window || window.URL && URL.revokeObjectURL && URL || window.webkitURL && webkitURL;
    f.detectSubsampling = function(b) {
        var c =
            b.width,
            d, a;
        return c * b.height > 1048576 ? (d = document.createElement("canvas"), d.width = d.height = 1, a = d.getContext("2d"), a.drawImage(b, -c + 1, 0), a.getImageData(0, 0, 1, 1).data[3] === 0) : false
    };
    f.detectVerticalSquash = function(b, c) {
        var d = document.createElement("canvas"),
            a = d.getContext("2d"),
            e, g, k;
        d.width = 1;
        d.height = c;
        a.drawImage(b, 0, 0);
        d = a.getImageData(0, 0, 1, c).data;
        a = 0;
        for (g = e = c; g > a;) {
            k = d[(g - 1) * 4 + 3];
            k === 0 ? e = g : a = g;
            g = e + a >> 1
        }
        return g / c
    };
    f.renderImageToCanvas = function(b, c, d, a) {
        var e = b.width,
            g = b.height;
        c = c.getContext("2d");
        var k, l = document.createElement("canvas"),
            o, n, m, p, r;
        c.save();
        f.detectSubsampling(b) && (e /= 2, g /= 2);
        k = f.detectVerticalSquash(b, g);
        l.width = l.height = 1024;
        o = l.getContext("2d");
        for (n = 0; n < g;) {
            m = n + 1024 > g ? g - n : 1024;
            for (p = 0; p < e;) {
                r = p + 1024 > e ? e - p : 1024;
                o.clearRect(0, 0, 1024, 1024);
                o.drawImage(b, -p, -n);
                c.drawImage(l, 0, 0, r, m, Math.floor(p * d / e), Math.floor(n * a / g / k), Math.ceil(r * d / e), Math.ceil(m * a / g / k));
                p += 1024
            }
            n += 1024
        }
        c.restore()
    };
    f.scale = function(b, c) {
        c = c || {};
        var d = document.createElement("canvas"),
            a = b.width,
            e = b.height,
            g = Math.max((c.minWidth || a) / a, (c.minHeight || e) / e);
        return g > 1 && (a = parseInt(a * g, 10), e = parseInt(e * g, 10)), g = Math.min((c.maxWidth || a) / a, (c.maxHeight || e) / e), g < 1 && (a = parseInt(a * g, 10), e = parseInt(e * g, 10)), b.getContext || c.canvas && d.getContext ? (d.width = a, d.height = e, b._type === "image/jpeg" ? f.renderImageToCanvas(b, d, a, e) : d.getContext("2d").drawImage(b, 0, 0, a, e), d) : (b.width = a, b.height = e, b)
    };
    f.createObjectURL = function(b) {
        return h ? h.createObjectURL(b) : false
    };
    f.revokeObjectURL = function(b) {
        return h ? h.revokeObjectURL(b) :
            false
    };
    f.readFile = function(b, c) {
        if (window.FileReader && FileReader.prototype.readAsDataURL) {
            var d = new FileReader;
            return d.onload = d.onerror = c, d.readAsDataURL(b), d
        }
        return false
    };
    typeof define == "function" && define.amd ? define(function() {
        return f
    }) : j.loadImage = f
})(this);
(function(j) {
    var f = function(h, b) {
        var c = !/[^\w\-\.:]/.test(h) ? f.cache[h] = f.cache[h] || f(f.load(h)) : new Function(f.arg + ",tmpl", "var _e=tmpl.encode" + f.helper + ",_s='" + h.replace(f.regexp, f.func) + "';return _s;");
        return b ? c(b, f) : function(d) {
            return c(d, f)
        }
    };
    f.cache = {};
    f.load = function(h) {
        return document.getElementById(h).innerHTML
    };
    f.regexp = /([\s'\\])(?![^%]*%\})|(?:\{%(=|#)([\s\S]+?)%\})|(\{%)|(%\})/g;
    f.func = function(h, b, c, d, a, e) {
        if (b) return {
            "\n": "\\n",
            "\r": "\\r",
            "\t": "\\t",
            " ": " "
        }[h] || "\\" + h;
        if (c) {
            if (c ===
                "=") return "'+_e(" + d + ")+'";
            return "'+(" + d + "||'')+'"
        }
        if (a) return "';";
        if (e) return "_s+='"
    };
    f.encReg = /[<>&"'\x00]/g;
    f.encMap = {
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&#39;"
    };
    f.encode = function(h) {
        return String(h || "").replace(f.encReg, function(b) {
            return f.encMap[b] || ""
        })
    };
    f.arg = "o";
    f.helper = ",print=function(s,e){_s+=e&&(s||'')||_e(s);},include=function(s,d){_s+=tmpl(s,d);}";
    if (typeof define === "function" && define.amd) define(function() {
        return f
    });
    else j.tmpl = f
})(this);
(function(j, f) {
    "function" === typeof define && define.amd ? define(["jquery"], f) : j.jQuery ? f(j.jQuery) : f(j.Zepto)
})(this, function(j, f) {
    j.fn.jPlayer = function(a) {
        var e = "string" === typeof a,
            g = Array.prototype.slice.call(arguments, 1),
            k = this;
        a = !e && g.length ? j.extend.apply(null, [true, a].concat(g)) : a;
        if (e && "_" === a.charAt(0)) return k;
        e ? this.each(function() {
            var l = j(this).data("jPlayer"),
                o = l && j.isFunction(l[a]) ? l[a].apply(l, g) : l;
            if (o !== l && o !== f) return k = o, false
        }) : this.each(function() {
            var l = j(this).data("jPlayer");
            l ?
                l.option(a || {}) : j(this).data("jPlayer", new j.jPlayer(a, this))
        });
        return k
    };
    j.jPlayer = function(a, e) {
        if (arguments.length) {
            this.element = j(e);
            this.options = j.extend(true, {}, this.options, a);
            var g = this;
            this.element.bind("remove.jPlayer", function() {
                g.destroy()
            });
            this._init()
        }
    };
    "function" !== typeof j.fn.stop && (j.fn.stop = function() {});
    j.jPlayer.emulateMethods = "load play pause";
    j.jPlayer.emulateStatus = "src readyState networkState currentTime duration paused ended playbackRate";
    j.jPlayer.emulateOptions = "muted volume";
    j.jPlayer.reservedEvent = "ready flashreset resize repeat error warning";
    j.jPlayer.event = {};
    j.each("ready flashreset resize repeat click error warning loadstart progress suspend abort emptied stalled play pause loadedmetadata loadeddata waiting playing canplay canplaythrough seeking seeked timeupdate ended ratechange durationchange volumechange".split(" "), function() {
        j.jPlayer.event[this] = "jPlayer_" + this
    });
    j.jPlayer.htmlEvent = "loadstart abort emptied stalled loadedmetadata loadeddata canplay canplaythrough ratechange".split(" ");
    j.jPlayer.pause = function() {
        j.each(j.jPlayer.prototype.instances, function(a, e) {
            e.data("jPlayer").status.srcSet && e.jPlayer("pause")
        })
    };
    j.jPlayer.timeFormat = {
        showHour: false,
        showMin: true,
        showSec: true,
        padHour: false,
        padMin: true,
        padSec: true,
        sepHour: ":",
        sepMin: ":",
        sepSec: ""
    };
    var h = function() {
        this.init()
    };
    h.prototype = {
        init: function() {
            this.options = {
                timeFormat: j.jPlayer.timeFormat
            }
        },
        time: function(a) {
            var e = new Date(1E3 * (a && "number" === typeof a ? a : 0)),
                g = e.getUTCHours();
            a = this.options.timeFormat.showHour ? e.getUTCMinutes() :
                e.getUTCMinutes() + 60 * g;
            e = this.options.timeFormat.showMin ? e.getUTCSeconds() : e.getUTCSeconds() + 60 * a;
            g = this.options.timeFormat.padHour && 10 > g ? "0" + g : g;
            a = this.options.timeFormat.padMin && 10 > a ? "0" + a : a;
            e = this.options.timeFormat.padSec && 10 > e ? "0" + e : e;
            g = "" + (this.options.timeFormat.showHour ? g + this.options.timeFormat.sepHour : "");
            g += this.options.timeFormat.showMin ? a + this.options.timeFormat.sepMin : "";
            return g + (this.options.timeFormat.showSec ? e + this.options.timeFormat.sepSec : "")
        }
    };
    var b = new h;
    j.jPlayer.convertTime =
        function(a) {
            return b.time(a)
        };
    j.jPlayer.uaBrowser = function(a) {
        a = a.toLowerCase();
        var e = /(opera)(?:.*version)?[ \/]([\w.]+)/,
            g = /(msie) ([\w.]+)/,
            k = /(mozilla)(?:.*? rv:([\w.]+))?/;
        a = /(webkit)[ \/]([\w.]+)/.exec(a) || e.exec(a) || g.exec(a) || 0 > a.indexOf("compatible") && k.exec(a) || [];
        return {
            browser: a[1] || "",
            version: a[2] || "0"
        }
    };
    j.jPlayer.uaPlatform = function(a) {
        var e = a.toLowerCase(),
            g = /(android)/,
            k = /(mobile)/;
        a = /(ipad|iphone|ipod|android|blackberry|playbook|windows ce|webos)/.exec(e) || [];
        e = /(ipad|playbook)/.exec(e) ||
            !k.exec(e) && g.exec(e) || [];
        a[1] && (a[1] = a[1].replace(/\s/g, "_"));
        return {
            platform: a[1] || "",
            tablet: e[1] || ""
        }
    };
    j.jPlayer.browser = {};
    j.jPlayer.platform = {};
    var c = j.jPlayer.uaBrowser(navigator.userAgent);
    c.browser && (j.jPlayer.browser[c.browser] = true, j.jPlayer.browser.version = c.version);
    c = j.jPlayer.uaPlatform(navigator.userAgent);
    c.platform && (j.jPlayer.platform[c.platform] = true, j.jPlayer.platform.mobile = !c.tablet, j.jPlayer.platform.tablet = !!c.tablet);
    j.jPlayer.getDocMode = function() {
        var a;
        j.jPlayer.browser.msie &&
            (document.documentMode ? a = document.documentMode : (a = 5, document.compatMode && "CSS1Compat" === document.compatMode && (a = 7)));
        return a
    };
    j.jPlayer.browser.documentMode = j.jPlayer.getDocMode();
    j.jPlayer.nativeFeatures = {
        init: function() {
            var a = document,
                e = a.createElement("video"),
                g = {
                    w3c: "fullscreenEnabled fullscreenElement requestFullscreen exitFullscreen fullscreenchange fullscreenerror".split(" "),
                    moz: "mozFullScreenEnabled mozFullScreenElement mozRequestFullScreen mozCancelFullScreen mozfullscreenchange mozfullscreenerror".split(" "),
                    webkit: " webkitCurrentFullScreenElement webkitRequestFullScreen webkitCancelFullScreen webkitfullscreenchange ".split(" "),
                    webkitVideo: "webkitSupportsFullscreen webkitDisplayingFullscreen webkitEnterFullscreen webkitExitFullscreen  ".split(" ")
                },
                k = ["w3c", "moz", "webkit", "webkitVideo"],
                l, o;
            this.fullscreen = e = {
                support: {
                    w3c: !!a[g.w3c[0]],
                    moz: !!a[g.moz[0]],
                    webkit: "function" === typeof a[g.webkit[3]],
                    webkitVideo: "function" === typeof e[g.webkitVideo[2]]
                },
                used: {}
            };
            l = 0;
            for (o = k.length; l < o; l++) {
                var n = k[l];
                if (e.support[n]) {
                    e.spec =
                        n;
                    e.used[n] = true;
                    break
                }
            }
            if (e.spec) {
                var m = g[e.spec];
                e.api = {
                    fullscreenEnabled: true,
                    fullscreenElement: function(p) {
                        p = p ? p : a;
                        return p[m[1]]
                    },
                    requestFullscreen: function(p) {
                        return p[m[2]]()
                    },
                    exitFullscreen: function(p) {
                        p = p ? p : a;
                        return p[m[3]]()
                    }
                };
                e.event = {
                    fullscreenchange: m[4],
                    fullscreenerror: m[5]
                }
            } else {
                e.api = {
                    fullscreenEnabled: false,
                    fullscreenElement: function() {
                        return null
                    },
                    requestFullscreen: function() {},
                    exitFullscreen: function() {}
                };
                e.event = {}
            }
        }
    };
    j.jPlayer.nativeFeatures.init();
    j.jPlayer.focus = null;
    j.jPlayer.keyIgnoreElementNames =
        "INPUT TEXTAREA";
    var d = function(a) {
        var e = j.jPlayer.focus,
            g;
        e && (j.each(j.jPlayer.keyIgnoreElementNames.split(/\s+/g), function(k, l) {
            if (a.target.nodeName.toUpperCase() === l.toUpperCase()) return g = true, false
        }), g || j.each(e.options.keyBindings, function(k, l) {
            if (l && a.which === l.key && j.isFunction(l.fn)) return a.preventDefault(), l.fn(e), false
        }))
    };
    j.jPlayer.keys = function(a) {
        j(document.documentElement).unbind("keydown.jPlayer");
        a && j(document.documentElement).bind("keydown.jPlayer", d)
    };
    j.jPlayer.keys(true);
    j.jPlayer.prototype = {
        count: 0,
        version: {
            script: "2.4.0",
            needFlash: "2.4.0",
            flash: "unknown"
        },
        options: {
            swfPath: "js",
            solution: "html, flash",
            supplied: "mp3",
            preload: "metadata",
            volume: 0.8,
            muted: false,
            wmode: "opaque",
            backgroundColor: "#000000",
            cssSelectorAncestor: "#jp_container_1",
            cssSelector: {
                videoPlay: ".jp-video-play",
                play: ".jp-play",
                pause: ".jp-pause",
                stop: ".jp-stop",
                seekBar: ".jp-seek-bar",
                playBar: ".jp-play-bar",
                mute: ".jp-mute",
                unmute: ".jp-unmute",
                volumeBar: ".jp-volume-bar",
                volumeBarValue: ".jp-volume-bar-value",
                volumeMax: ".jp-volume-max",
                currentTime: ".jp-current-time",
                duration: ".jp-duration",
                fullScreen: ".jp-full-screen",
                restoreScreen: ".jp-restore-screen",
                repeat: ".jp-repeat",
                repeatOff: ".jp-repeat-off",
                gui: ".jp-gui",
                noSolution: ".jp-no-solution"
            },
            smoothPlayBar: false,
            fullScreen: false,
            fullWindow: false,
            autohide: {
                restored: false,
                full: true,
                fadeIn: 200,
                fadeOut: 600,
                hold: 1E3
            },
            loop: false,
            repeat: function(a) {
                a.jPlayer.options.loop ? j(this).unbind(".jPlayerRepeat").bind(j.jPlayer.event.ended + ".jPlayer.jPlayerRepeat", function() {
                        j(this).jPlayer("play")
                    }) :
                    j(this).unbind(".jPlayerRepeat")
            },
            nativeVideoControls: {},
            noFullWindow: {
                msie: /msie [0-6]\./,
                ipad: /ipad.*?os [0-4]\./,
                iphone: /iphone/,
                ipod: /ipod/,
                android_pad: /android [0-3]\.(?!.*?mobile)/,
                android_phone: /android.*?mobile/,
                blackberry: /blackberry/,
                windows_ce: /windows ce/,
                iemobile: /iemobile/,
                webos: /webos/
            },
            noVolume: {
                ipad: /ipad/,
                iphone: /iphone/,
                ipod: /ipod/,
                android_pad: /android(?!.*?mobile)/,
                android_phone: /android.*?mobile/,
                blackberry: /blackberry/,
                windows_ce: /windows ce/,
                iemobile: /iemobile/,
                webos: /webos/,
                playbook: /playbook/
            },
            timeFormat: {},
            keyEnabled: false,
            audioFullScreen: false,
            keyBindings: {
                play: {
                    key: 32,
                    fn: function(a) {
                        a.status.paused ? a.play() : a.pause()
                    }
                },
                fullScreen: {
                    key: 13,
                    fn: function(a) {
                        (a.status.video || a.options.audioFullScreen) && a._setOption("fullScreen", !a.options.fullScreen)
                    }
                },
                muted: {
                    key: 8,
                    fn: function(a) {
                        a._muted(!a.options.muted)
                    }
                },
                volumeUp: {
                    key: 38,
                    fn: function(a) {
                        a.volume(a.options.volume + 0.1)
                    }
                },
                volumeDown: {
                    key: 40,
                    fn: function(a) {
                        a.volume(a.options.volume - 0.1)
                    }
                }
            },
            verticalVolume: false,
            idPrefix: "jp",
            noConflict: "jQuery",
            emulateHtml: false,
            errorAlerts: false,
            warningAlerts: false
        },
        optionsAudio: {
            size: {
                width: "0px",
                height: "0px",
                cssClass: ""
            },
            sizeFull: {
                width: "0px",
                height: "0px",
                cssClass: ""
            }
        },
        optionsVideo: {
            size: {
                width: "480px",
                height: "270px",
                cssClass: "jp-video-270p"
            },
            sizeFull: {
                width: "100%",
                height: "100%",
                cssClass: "jp-video-full"
            }
        },
        instances: {},
        status: {
            src: "",
            media: {},
            paused: true,
            format: {},
            formatType: "",
            waitForPlay: true,
            waitForLoad: true,
            srcSet: false,
            video: false,
            seekPercent: 0,
            currentPercentRelative: 0,
            currentPercentAbsolute: 0,
            currentTime: 0,
            duration: 0,
            videoWidth: 0,
            videoHeight: 0,
            readyState: 0,
            networkState: 0,
            playbackRate: 1,
            ended: 0
        },
        internal: {
            ready: false
        },
        solution: {
            html: true,
            flash: true
        },
        format: {
            mp3: {
                codec: 'audio/mpeg; codecs="mp3"',
                flashCanPlay: true,
                media: "audio"
            },
            m4a: {
                codec: 'audio/mp4; codecs="mp4a.40.2"',
                flashCanPlay: true,
                media: "audio"
            },
            oga: {
                codec: 'audio/ogg; codecs="vorbis"',
                flashCanPlay: false,
                media: "audio"
            },
            wav: {
                codec: 'audio/wav; codecs="1"',
                flashCanPlay: false,
                media: "audio"
            },
            webma: {
                codec: 'audio/webm; codecs="vorbis"',
                flashCanPlay: false,
                media: "audio"
            },
            fla: {
                codec: "audio/x-flv",
                flashCanPlay: true,
                media: "audio"
            },
            rtmpa: {
                codec: 'audio/rtmp; codecs="rtmp"',
                flashCanPlay: true,
                media: "audio"
            },
            m4v: {
                codec: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
                flashCanPlay: true,
                media: "video"
            },
            ogv: {
                codec: 'video/ogg; codecs="theora, vorbis"',
                flashCanPlay: false,
                media: "video"
            },
            webmv: {
                codec: 'video/webm; codecs="vorbis, vp8"',
                flashCanPlay: false,
                media: "video"
            },
            flv: {
                codec: "video/x-flv",
                flashCanPlay: true,
                media: "video"
            },
            rtmpv: {
                codec: 'video/rtmp; codecs="rtmp"',
                flashCanPlay: true,
                media: "video"
            }
        },
        _init: function() {
            var a = this;
            this.element.empty();
            this.status = j.extend({}, this.status);
            this.internal = j.extend({}, this.internal);
            this.options.timeFormat = j.extend({}, j.jPlayer.timeFormat, this.options.timeFormat);
            this.internal.cmdsIgnored = j.jPlayer.platform.ipad || j.jPlayer.platform.iphone || j.jPlayer.platform.ipod;
            this.internal.domNode = this.element.get(0);
            this.options.keyEnabled && !j.jPlayer.focus && (j.jPlayer.focus = this);
            this.formats = [];
            this.solutions = [];
            this.require = {};
            this.htmlElement = {};
            this.html = {};
            this.html.audio = {};
            this.html.video = {};
            this.flash = {};
            this.css = {};
            this.css.cs = {};
            this.css.jq = {};
            this.ancestorJq = [];
            this.options.volume = this._limitValue(this.options.volume, 0, 1);
            j.each(this.options.supplied.toLowerCase().split(","), function(l, o) {
                var n = o.replace(/^\s+|\s+$/g, "");
                if (a.format[n]) {
                    var m = false;
                    j.each(a.formats, function(p, r) {
                        if (n === r) return m = true, false
                    });
                    m || a.formats.push(n)
                }
            });
            j.each(this.options.solution.toLowerCase().split(","), function(l, o) {
                var n = o.replace(/^\s+|\s+$/g,
                    "");
                if (a.solution[n]) {
                    var m = false;
                    j.each(a.solutions, function(p, r) {
                        if (n === r) return m = true, false
                    });
                    m || a.solutions.push(n)
                }
            });
            this.internal.instance = "jp_" + this.count;
            this.instances[this.internal.instance] = this.element;
            this.element.attr("id") || this.element.attr("id", this.options.idPrefix + "_jplayer_" + this.count);
            this.internal.self = j.extend({}, {
                id: this.element.attr("id"),
                jq: this.element
            });
            this.internal.audio = j.extend({}, {
                id: this.options.idPrefix + "_audio_" + this.count,
                jq: f
            });
            this.internal.video = j.extend({}, {
                id: this.options.idPrefix + "_video_" + this.count,
                jq: f
            });
            this.internal.flash = j.extend({}, {
                id: this.options.idPrefix + "_flash_" + this.count,
                jq: f,
                swf: this.options.swfPath + (".swf" !== this.options.swfPath.toLowerCase().slice(-4) ? (this.options.swfPath && "/" !== this.options.swfPath.slice(-1) ? "/" : "") + "Jplayer.swf" : "")
            });
            this.internal.poster = j.extend({}, {
                id: this.options.idPrefix + "_poster_" + this.count,
                jq: f
            });
            j.each(j.jPlayer.event, function(l, o) {
                a.options[l] !== f && (a.element.bind(o + ".jPlayer", a.options[l]), a.options[l] =
                    f)
            });
            this.require.audio = false;
            this.require.video = false;
            j.each(this.formats, function(l, o) {
                a.require[a.format[o].media] = true
            });
            this.options = this.require.video ? j.extend(true, {}, this.optionsVideo, this.options) : j.extend(true, {}, this.optionsAudio, this.options);
            this._setSize();
            this.status.nativeVideoControls = this._uaBlocklist(this.options.nativeVideoControls);
            this.status.noFullWindow = this._uaBlocklist(this.options.noFullWindow);
            this.status.noVolume = this._uaBlocklist(this.options.noVolume);
            j.jPlayer.nativeFeatures.fullscreen.api.fullscreenEnabled &&
                this._fullscreenAddEventListeners();
            this._restrictNativeVideoControls();
            this.htmlElement.poster = document.createElement("img");
            this.htmlElement.poster.id = this.internal.poster.id;
            this.htmlElement.poster.onload = function() {
                (!a.status.video || a.status.waitForPlay) && a.internal.poster.jq.show()
            };
            this.element.append(this.htmlElement.poster);
            this.internal.poster.jq = j("#" + this.internal.poster.id);
            this.internal.poster.jq.css({
                width: this.status.width,
                height: this.status.height
            });
            this.internal.poster.jq.hide();
            this.internal.poster.jq.bind("click.jPlayer", function() {
                a._trigger(j.jPlayer.event.click)
            });
            this.html.audio.available = false;
            this.require.audio && (this.htmlElement.audio = document.createElement("audio"), this.htmlElement.audio.id = this.internal.audio.id, this.html.audio.available = !!this.htmlElement.audio.canPlayType && this._testCanPlayType(this.htmlElement.audio));
            this.html.video.available = false;
            this.require.video && (this.htmlElement.video = document.createElement("video"), this.htmlElement.video.id = this.internal.video.id,
                this.html.video.available = !!this.htmlElement.video.canPlayType && this._testCanPlayType(this.htmlElement.video));
            this.flash.available = this._checkForFlash(10.1);
            this.html.canPlay = {};
            this.flash.canPlay = {};
            j.each(this.formats, function(l, o) {
                a.html.canPlay[o] = a.html[a.format[o].media].available && "" !== a.htmlElement[a.format[o].media].canPlayType(a.format[o].codec);
                a.flash.canPlay[o] = a.format[o].flashCanPlay && a.flash.available
            });
            this.html.desired = false;
            this.flash.desired = false;
            j.each(this.solutions, function(l,
                o) {
                if (0 === l) a[o].desired = true;
                else {
                    var n = false,
                        m = false;
                    j.each(a.formats, function(p, r) {
                        a[a.solutions[0]].canPlay[r] && ("video" === a.format[r].media ? m = true : n = true)
                    });
                    a[o].desired = a.require.audio && !n || a.require.video && !m
                }
            });
            this.html.support = {};
            this.flash.support = {};
            j.each(this.formats, function(l, o) {
                a.html.support[o] = a.html.canPlay[o] && a.html.desired;
                a.flash.support[o] = a.flash.canPlay[o] && a.flash.desired
            });
            this.html.used = false;
            this.flash.used = false;
            j.each(this.solutions, function(l, o) {
                j.each(a.formats,
                    function(n, m) {
                        if (a[o].support[m]) return a[o].used = true, false
                    })
            });
            this._resetActive();
            this._resetGate();
            this._cssSelectorAncestor(this.options.cssSelectorAncestor);
            !this.html.used && !this.flash.used ? (this._error({
                    type: j.jPlayer.error.NO_SOLUTION,
                    context: "{solution:'" + this.options.solution + "', supplied:'" + this.options.supplied + "'}",
                    message: j.jPlayer.errorMsg.NO_SOLUTION,
                    hint: j.jPlayer.errorHint.NO_SOLUTION
                }), this.css.jq.noSolution.length && this.css.jq.noSolution.show()) : this.css.jq.noSolution.length &&
                this.css.jq.noSolution.hide();
            if (this.flash.used) {
                var e, g = "jQuery=" + encodeURI(this.options.noConflict) + "&id=" + encodeURI(this.internal.self.id) + "&vol=" + this.options.volume + "&muted=" + this.options.muted;
                if (j.jPlayer.browser.msie && (9 > Number(j.jPlayer.browser.version) || 9 > j.jPlayer.browser.documentMode)) {
                    g = ['<param name="movie" value="' + this.internal.flash.swf + '" />', '<param name="FlashVars" value="' + g + '" />', '<param name="allowScriptAccess" value="always" />', '<param name="bgcolor" value="' + this.options.backgroundColor +
                        '" />', '<param name="wmode" value="' + this.options.wmode + '" />'
                    ];
                    e = document.createElement('<object id="' + this.internal.flash.id + '" classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000" width="0" height="0" tabindex="-1"></object>');
                    for (var k = 0; k < g.length; k++) e.appendChild(document.createElement(g[k]))
                } else {
                    k = function(l, o, n) {
                        var m = document.createElement("param");
                        m.setAttribute("name", o);
                        m.setAttribute("value", n);
                        l.appendChild(m)
                    };
                    e = document.createElement("object");
                    e.setAttribute("id", this.internal.flash.id);
                    e.setAttribute("name", this.internal.flash.id);
                    e.setAttribute("data", this.internal.flash.swf);
                    e.setAttribute("type", "application/x-shockwave-flash");
                    e.setAttribute("width", "1");
                    e.setAttribute("height", "1");
                    e.setAttribute("tabindex", "-1");
                    k(e, "flashvars", g);
                    k(e, "allowscriptaccess", "always");
                    k(e, "bgcolor", this.options.backgroundColor);
                    k(e, "wmode", this.options.wmode)
                }
                this.element.append(e);
                this.internal.flash.jq = j(e)
            }
            this.html.used && (this.html.audio.available && (this._addHtmlEventListeners(this.htmlElement.audio,
                this.html.audio), this.element.append(this.htmlElement.audio), this.internal.audio.jq = j("#" + this.internal.audio.id)), this.html.video.available && (this._addHtmlEventListeners(this.htmlElement.video, this.html.video), this.element.append(this.htmlElement.video), this.internal.video.jq = j("#" + this.internal.video.id), this.status.nativeVideoControls ? this.internal.video.jq.css({
                width: this.status.width,
                height: this.status.height
            }) : this.internal.video.jq.css({
                width: "0px",
                height: "0px"
            }), this.internal.video.jq.bind("click.jPlayer",
                function() {
                    a._trigger(j.jPlayer.event.click)
                })));
            this.options.emulateHtml && this._emulateHtmlBridge();
            this.html.used && !this.flash.used && setTimeout(function() {
                a.internal.ready = true;
                a.version.flash = "n/a";
                a._trigger(j.jPlayer.event.repeat);
                a._trigger(j.jPlayer.event.ready)
            }, 100);
            this._updateNativeVideoControls();
            this.css.jq.videoPlay.length && this.css.jq.videoPlay.hide();
            j.jPlayer.prototype.count++
        },
        destroy: function() {
            this.clearMedia();
            this._removeUiClass();
            this.css.jq.currentTime.length && this.css.jq.currentTime.text("");
            this.css.jq.duration.length && this.css.jq.duration.text("");
            j.each(this.css.jq, function(a, e) {
                e.length && e.unbind(".jPlayer")
            });
            this.internal.poster.jq.unbind(".jPlayer");
            this.internal.video.jq && this.internal.video.jq.unbind(".jPlayer");
            this._fullscreenRemoveEventListeners();
            this === j.jPlayer.focus && (j.jPlayer.focus = null);
            this.options.emulateHtml && this._destroyHtmlBridge();
            this.element.removeData("jPlayer");
            this.element.unbind(".jPlayer");
            this.element.empty();
            delete this.instances[this.internal.instance]
        },
        enable: function() {},
        disable: function() {},
        _testCanPlayType: function(a) {
            try {
                return a.canPlayType(this.format.mp3.codec), true
            } catch (e) {
                return false
            }
        },
        _uaBlocklist: function(a) {
            var e = navigator.userAgent.toLowerCase(),
                g = false;
            j.each(a, function(k, l) {
                if (l && l.test(e)) return g = true, false
            });
            return g
        },
        _restrictNativeVideoControls: function() {
            this.require.audio && this.status.nativeVideoControls && (this.status.nativeVideoControls = false, this.status.noFullWindow = true)
        },
        _updateNativeVideoControls: function() {
            this.html.video.available &&
                this.html.used && (this.htmlElement.video.controls = this.status.nativeVideoControls, this._updateAutohide(), this.status.nativeVideoControls && this.require.video ? (this.internal.poster.jq.hide(), this.internal.video.jq.css({
                    width: this.status.width,
                    height: this.status.height
                })) : this.status.waitForPlay && this.status.video && (this.internal.poster.jq.show(), this.internal.video.jq.css({
                    width: "0px",
                    height: "0px"
                })))
        },
        _addHtmlEventListeners: function(a, e) {
            var g = this;
            a.preload = this.options.preload;
            a.muted = this.options.muted;
            a.volume = this.options.volume;
            a.addEventListener("progress", function() {
                e.gate && (g.internal.cmdsIgnored && 0 < this.readyState && (g.internal.cmdsIgnored = false), g._getHtmlStatus(a), g._updateInterface(), g._trigger(j.jPlayer.event.progress))
            }, false);
            a.addEventListener("timeupdate", function() {
                e.gate && (g._getHtmlStatus(a), g._updateInterface(), g._trigger(j.jPlayer.event.timeupdate))
            }, false);
            a.addEventListener("durationchange", function() {
                    e.gate && (g._getHtmlStatus(a), g._updateInterface(), g._trigger(j.jPlayer.event.durationchange))
                },
                false);
            a.addEventListener("play", function() {
                e.gate && (g._updateButtons(true), g._html_checkWaitForPlay(), g._trigger(j.jPlayer.event.play))
            }, false);
            a.addEventListener("playing", function() {
                e.gate && (g._updateButtons(true), g._seeked(), g._trigger(j.jPlayer.event.playing))
            }, false);
            a.addEventListener("pause", function() {
                e.gate && (g._updateButtons(false), g._trigger(j.jPlayer.event.pause))
            }, false);
            a.addEventListener("waiting", function() {
                e.gate && (g._seeking(), g._trigger(j.jPlayer.event.waiting))
            }, false);
            a.addEventListener("seeking",
                function() {
                    e.gate && (g._seeking(), g._trigger(j.jPlayer.event.seeking))
                }, false);
            a.addEventListener("seeked", function() {
                e.gate && (g._seeked(), g._trigger(j.jPlayer.event.seeked))
            }, false);
            a.addEventListener("volumechange", function() {
                e.gate && (g.options.volume = a.volume, g.options.muted = a.muted, g._updateMute(), g._updateVolume(), g._trigger(j.jPlayer.event.volumechange))
            }, false);
            a.addEventListener("suspend", function() {
                e.gate && (g._seeked(), g._trigger(j.jPlayer.event.suspend))
            }, false);
            a.addEventListener("ended",
                function() {
                    e.gate && (j.jPlayer.browser.webkit || (g.htmlElement.media.currentTime = 0), g.htmlElement.media.pause(), g._updateButtons(false), g._getHtmlStatus(a, true), g._updateInterface(), g._trigger(j.jPlayer.event.ended))
                }, false);
            a.addEventListener("error", function() {
                e.gate && (g._updateButtons(false), g._seeked(), g.status.srcSet && (clearTimeout(g.internal.htmlDlyCmdId), g.status.waitForLoad = true, g.status.waitForPlay = true, g.status.video && !g.status.nativeVideoControls && g.internal.video.jq.css({
                        width: "0px",
                        height: "0px"
                    }),
                    g._validString(g.status.media.poster) && !g.status.nativeVideoControls && g.internal.poster.jq.show(), g.css.jq.videoPlay.length && g.css.jq.videoPlay.show(), g._error({
                        type: j.jPlayer.error.URL,
                        context: g.status.src,
                        message: j.jPlayer.errorMsg.URL,
                        hint: j.jPlayer.errorHint.URL
                    })))
            }, false);
            j.each(j.jPlayer.htmlEvent, function(k, l) {
                a.addEventListener(this, function() {
                    e.gate && g._trigger(j.jPlayer.event[l])
                }, false)
            })
        },
        _getHtmlStatus: function(a, e) {
            var g = 0,
                k = 0,
                l = 0,
                o = 0;
            isFinite(a.duration) && (this.status.duration = a.duration);
            g = a.currentTime;
            k = 0 < this.status.duration ? 100 * g / this.status.duration : 0;
            "object" === typeof a.seekable && 0 < a.seekable.length ? (l = 0 < this.status.duration ? 100 * a.seekable.end(a.seekable.length - 1) / this.status.duration : 100, o = 0 < this.status.duration ? 100 * a.currentTime / a.seekable.end(a.seekable.length - 1) : 0) : (l = 100, o = k);
            e && (k = o = g = 0);
            this.status.seekPercent = l;
            this.status.currentPercentRelative = o;
            this.status.currentPercentAbsolute = k;
            this.status.currentTime = g;
            this.status.videoWidth = a.videoWidth;
            this.status.videoHeight =
                a.videoHeight;
            this.status.readyState = a.readyState;
            this.status.networkState = a.networkState;
            this.status.playbackRate = a.playbackRate;
            this.status.ended = a.ended
        },
        _resetStatus: function() {
            this.status = j.extend({}, this.status, j.jPlayer.prototype.status)
        },
        _trigger: function(a, e, g) {
            a = j.Event(a);
            a.jPlayer = {};
            a.jPlayer.version = j.extend({}, this.version);
            a.jPlayer.options = j.extend(true, {}, this.options);
            a.jPlayer.status = j.extend(true, {}, this.status);
            a.jPlayer.html = j.extend(true, {}, this.html);
            a.jPlayer.flash = j.extend(true, {}, this.flash);
            e && (a.jPlayer.error = j.extend({}, e));
            g && (a.jPlayer.warning = j.extend({}, g));
            this.element.trigger(a)
        },
        jPlayerFlashEvent: function(a, e) {
            if (a === j.jPlayer.event.ready)
                if (this.internal.ready) {
                    if (this.flash.gate) {
                        if (this.status.srcSet) {
                            var g = this.status.currentTime,
                                k = this.status.paused;
                            this.setMedia(this.status.media);
                            0 < g && (k ? this.pause(g) : this.play(g))
                        }
                        this._trigger(j.jPlayer.event.flashreset)
                    }
                } else {
                    this.internal.ready = true;
                    this.internal.flash.jq.css({
                        width: "0px",
                        height: "0px"
                    });
                    this.version.flash =
                        e.version;
                    this.version.needFlash !== this.version.flash && this._error({
                        type: j.jPlayer.error.VERSION,
                        context: this.version.flash,
                        message: j.jPlayer.errorMsg.VERSION + this.version.flash,
                        hint: j.jPlayer.errorHint.VERSION
                    });
                    this._trigger(j.jPlayer.event.repeat);
                    this._trigger(a)
                }
            if (this.flash.gate) switch (a) {
                case j.jPlayer.event.progress:
                    this._getFlashStatus(e);
                    this._updateInterface();
                    this._trigger(a);
                    break;
                case j.jPlayer.event.timeupdate:
                    this._getFlashStatus(e);
                    this._updateInterface();
                    this._trigger(a);
                    break;
                case j.jPlayer.event.play:
                    this._seeked();
                    this._updateButtons(true);
                    this._trigger(a);
                    break;
                case j.jPlayer.event.pause:
                    this._updateButtons(false);
                    this._trigger(a);
                    break;
                case j.jPlayer.event.ended:
                    this._updateButtons(false);
                    this._trigger(a);
                    break;
                case j.jPlayer.event.click:
                    this._trigger(a);
                    break;
                case j.jPlayer.event.error:
                    this.status.waitForLoad = true;
                    this.status.waitForPlay = true;
                    this.status.video && this.internal.flash.jq.css({
                        width: "0px",
                        height: "0px"
                    });
                    this._validString(this.status.media.poster) && this.internal.poster.jq.show();
                    this.css.jq.videoPlay.length && this.status.video && this.css.jq.videoPlay.show();
                    this.status.video ? this._flash_setVideo(this.status.media) : this._flash_setAudio(this.status.media);
                    this._updateButtons(false);
                    this._error({
                        type: j.jPlayer.error.URL,
                        context: e.src,
                        message: j.jPlayer.errorMsg.URL,
                        hint: j.jPlayer.errorHint.URL
                    });
                    break;
                case j.jPlayer.event.seeking:
                    this._seeking();
                    this._trigger(a);
                    break;
                case j.jPlayer.event.seeked:
                    this._seeked();
                    this._trigger(a);
                    break;
                case j.jPlayer.event.ready:
                    break;
                default:
                    this._trigger(a)
            }
            return false
        },
        _getFlashStatus: function(a) {
            this.status.seekPercent = a.seekPercent;
            this.status.currentPercentRelative = a.currentPercentRelative;
            this.status.currentPercentAbsolute = a.currentPercentAbsolute;
            this.status.currentTime = a.currentTime;
            this.status.duration = a.duration;
            this.status.videoWidth = a.videoWidth;
            this.status.videoHeight = a.videoHeight;
            this.status.readyState = 4;
            this.status.networkState = 0;
            this.status.playbackRate = 1;
            this.status.ended = false
        },
        _updateButtons: function(a) {
            a === f ? a = !this.status.paused : this.status.paused = !a;
            this.css.jq.play.length && this.css.jq.pause.length && (a ? (this.css.jq.play.hide(), this.css.jq.pause.show()) : (this.css.jq.play.show(), this.css.jq.pause.hide()));
            this.css.jq.restoreScreen.length && this.css.jq.fullScreen.length && (this.status.noFullWindow ? (this.css.jq.fullScreen.hide(), this.css.jq.restoreScreen.hide()) : this.options.fullWindow ? (this.css.jq.fullScreen.hide(), this.css.jq.restoreScreen.show()) : (this.css.jq.fullScreen.show(), this.css.jq.restoreScreen.hide()));
            this.css.jq.repeat.length && this.css.jq.repeatOff.length &&
                (this.options.loop ? (this.css.jq.repeat.hide(), this.css.jq.repeatOff.show()) : (this.css.jq.repeat.show(), this.css.jq.repeatOff.hide()))
        },
        _updateInterface: function() {
            this.css.jq.seekBar.length && this.css.jq.seekBar.width(this.status.seekPercent + "%");
            this.css.jq.playBar.length && (this.options.smoothPlayBar ? this.css.jq.playBar.stop().animate({
                width: this.status.currentPercentAbsolute + "%"
            }, 250, "linear") : this.css.jq.playBar.width(this.status.currentPercentRelative + "%"));
            this.css.jq.currentTime.length && this.css.jq.currentTime.text(this._convertTime(this.status.currentTime));
            this.css.jq.duration.length && this.css.jq.duration.text(this._convertTime(this.status.duration))
        },
        _convertTime: h.prototype.time,
        _seeking: function() {
            this.css.jq.seekBar.length && this.css.jq.seekBar.addClass("jp-seeking-bg")
        },
        _seeked: function() {
            this.css.jq.seekBar.length && this.css.jq.seekBar.removeClass("jp-seeking-bg")
        },
        _resetGate: function() {
            this.html.audio.gate = false;
            this.html.video.gate = false;
            this.flash.gate = false
        },
        _resetActive: function() {
            this.html.active = false;
            this.flash.active = false
        },
        setMedia: function(a) {
            var e =
                this,
                g = false,
                k = this.status.media.poster !== a.poster;
            this._resetMedia();
            this._resetGate();
            this._resetActive();
            j.each(this.formats, function(l, o) {
                var n = "video" === e.format[o].media;
                j.each(e.solutions, function(m, p) {
                    if (e[p].support[o] && e._validString(a[o])) {
                        var r = "html" === p;
                        n ? (r ? (e.html.video.gate = true, e._html_setVideo(a), e.html.active = true) : (e.flash.gate = true, e._flash_setVideo(a), e.flash.active = true), e.css.jq.videoPlay.length && e.css.jq.videoPlay.show(), e.status.video = true) : (r ? (e.html.audio.gate = true, e._html_setAudio(a),
                            e.html.active = true) : (e.flash.gate = true, e._flash_setAudio(a), e.flash.active = true), e.css.jq.videoPlay.length && e.css.jq.videoPlay.hide(), e.status.video = false);
                        g = true;
                        return false
                    }
                });
                if (g) return false
            });
            if (g) {
                if ((!this.status.nativeVideoControls || !this.html.video.gate) && this._validString(a.poster)) k ? this.htmlElement.poster.src = a.poster : this.internal.poster.jq.show();
                this.status.srcSet = true;
                this.status.media = j.extend({}, a);
                this._updateButtons(false);
                this._updateInterface()
            } else this._error({
                type: j.jPlayer.error.NO_SUPPORT,
                context: "{supplied:'" + this.options.supplied + "'}",
                message: j.jPlayer.errorMsg.NO_SUPPORT,
                hint: j.jPlayer.errorHint.NO_SUPPORT
            })
        },
        _resetMedia: function() {
            this._resetStatus();
            this._updateButtons(false);
            this._updateInterface();
            this._seeked();
            this.internal.poster.jq.hide();
            clearTimeout(this.internal.htmlDlyCmdId);
            this.html.active ? this._html_resetMedia() : this.flash.active && this._flash_resetMedia()
        },
        clearMedia: function() {
            this._resetMedia();
            this.html.active ? this._html_clearMedia() : this.flash.active && this._flash_clearMedia();
            this._resetGate();
            this._resetActive()
        },
        load: function() {
            this.status.srcSet ? this.html.active ? this._html_load() : this.flash.active && this._flash_load() : this._urlNotSetError("load")
        },
        focus: function() {
            this.options.keyEnabled && (j.jPlayer.focus = this)
        },
        play: function(a) {
            a = "number" === typeof a ? a : NaN;
            this.status.srcSet ? (this.focus(), this.html.active ? this._html_play(a) : this.flash.active && this._flash_play(a)) : this._urlNotSetError("play")
        },
        videoPlay: function() {
            this.play()
        },
        pause: function(a) {
            a = "number" === typeof a ?
                a : NaN;
            this.status.srcSet ? this.html.active ? this._html_pause(a) : this.flash.active && this._flash_pause(a) : this._urlNotSetError("pause")
        },
        pauseOthers: function() {
            var a = this;
            j.each(this.instances, function(e, g) {
                a.element !== g && g.data("jPlayer").status.srcSet && g.jPlayer("pause")
            })
        },
        stop: function() {
            this.status.srcSet ? this.html.active ? this._html_pause(0) : this.flash.active && this._flash_pause(0) : this._urlNotSetError("stop")
        },
        playHead: function(a) {
            a = this._limitValue(a, 0, 100);
            this.status.srcSet ? this.html.active ? this._html_playHead(a) :
                this.flash.active && this._flash_playHead(a) : this._urlNotSetError("playHead")
        },
        _muted: function(a) {
            this.options.muted = a;
            this.html.used && this._html_mute(a);
            this.flash.used && this._flash_mute(a);
            !this.html.video.gate && !this.html.audio.gate && (this._updateMute(a), this._updateVolume(this.options.volume), this._trigger(j.jPlayer.event.volumechange))
        },
        mute: function(a) {
            a = a === f ? true : !!a;
            this._muted(a)
        },
        unmute: function(a) {
            a = a === f ? true : !!a;
            this._muted(!a)
        },
        _updateMute: function(a) {
            a === f && (a = this.options.muted);
            this.css.jq.mute.length &&
                this.css.jq.unmute.length && (this.status.noVolume ? (this.css.jq.mute.hide(), this.css.jq.unmute.hide()) : a ? (this.css.jq.mute.hide(), this.css.jq.unmute.show()) : (this.css.jq.mute.show(), this.css.jq.unmute.hide()))
        },
        volume: function(a) {
            a = this._limitValue(a, 0, 1);
            this.options.volume = a;
            this.html.used && this._html_volume(a);
            this.flash.used && this._flash_volume(a);
            !this.html.video.gate && !this.html.audio.gate && (this._updateVolume(a), this._trigger(j.jPlayer.event.volumechange))
        },
        volumeBar: function(a) {
            if (this.css.jq.volumeBar.length) {
                var e =
                    j(a.currentTarget),
                    g = e.offset(),
                    k = a.pageX - g.left,
                    l = e.width();
                a = e.height() - a.pageY + g.top;
                e = e.height();
                this.options.verticalVolume ? this.volume(a / e) : this.volume(k / l)
            }
            this.options.muted && this._muted(false)
        },
        volumeBarValue: function() {},
        _updateVolume: function(a) {
            a === f && (a = this.options.volume);
            a = this.options.muted ? 0 : a;
            this.status.noVolume ? (this.css.jq.volumeBar.length && this.css.jq.volumeBar.hide(), this.css.jq.volumeBarValue.length && this.css.jq.volumeBarValue.hide(), this.css.jq.volumeMax.length && this.css.jq.volumeMax.hide()) :
                (this.css.jq.volumeBar.length && this.css.jq.volumeBar.show(), this.css.jq.volumeBarValue.length && (this.css.jq.volumeBarValue.show(), this.css.jq.volumeBarValue[this.options.verticalVolume ? "height" : "width"](100 * a + "%")), this.css.jq.volumeMax.length && this.css.jq.volumeMax.show())
        },
        volumeMax: function() {
            this.volume(1);
            this.options.muted && this._muted(false)
        },
        _cssSelectorAncestor: function(a) {
            var e = this;
            this.options.cssSelectorAncestor = a;
            this._removeUiClass();
            this.ancestorJq = a ? j(a) : [];
            a && 1 !== this.ancestorJq.length &&
                this._warning({
                    type: j.jPlayer.warning.CSS_SELECTOR_COUNT,
                    context: a,
                    message: j.jPlayer.warningMsg.CSS_SELECTOR_COUNT + this.ancestorJq.length + " found for cssSelectorAncestor.",
                    hint: j.jPlayer.warningHint.CSS_SELECTOR_COUNT
                });
            this._addUiClass();
            j.each(this.options.cssSelector, function(g, k) {
                e._cssSelector(g, k)
            });
            this._updateInterface();
            this._updateButtons();
            this._updateAutohide();
            this._updateVolume();
            this._updateMute()
        },
        _cssSelector: function(a, e) {
            var g = this;
            "string" === typeof e ? j.jPlayer.prototype.options.cssSelector[a] ?
                (this.css.jq[a] && this.css.jq[a].length && this.css.jq[a].unbind(".jPlayer"), this.options.cssSelector[a] = e, this.css.cs[a] = this.options.cssSelectorAncestor + " " + e, this.css.jq[a] = e ? j(this.css.cs[a]) : [], this.css.jq[a].length && this.css.jq[a].bind("click.jPlayer", function(k) {
                    k.preventDefault();
                    g[a](k);
                    j(this).blur()
                }), e && 1 !== this.css.jq[a].length && this._warning({
                    type: j.jPlayer.warning.CSS_SELECTOR_COUNT,
                    context: this.css.cs[a],
                    message: j.jPlayer.warningMsg.CSS_SELECTOR_COUNT + this.css.jq[a].length + " found for " +
                        a + " method.",
                    hint: j.jPlayer.warningHint.CSS_SELECTOR_COUNT
                })) : this._warning({
                    type: j.jPlayer.warning.CSS_SELECTOR_METHOD,
                    context: a,
                    message: j.jPlayer.warningMsg.CSS_SELECTOR_METHOD,
                    hint: j.jPlayer.warningHint.CSS_SELECTOR_METHOD
                }) : this._warning({
                    type: j.jPlayer.warning.CSS_SELECTOR_STRING,
                    context: e,
                    message: j.jPlayer.warningMsg.CSS_SELECTOR_STRING,
                    hint: j.jPlayer.warningHint.CSS_SELECTOR_STRING
                })
        },
        seekBar: function(a) {
            if (this.css.jq.seekBar.length) {
                var e = j(a.currentTarget),
                    g = e.offset();
                a = a.pageX - g.left;
                e = e.width();
                this.playHead(100 * a / e)
            }
        },
        playBar: function() {},
        repeat: function() {
            this._loop(true)
        },
        repeatOff: function() {
            this._loop(false)
        },
        _loop: function(a) {
            this.options.loop !== a && (this.options.loop = a, this._updateButtons(), this._trigger(j.jPlayer.event.repeat))
        },
        currentTime: function() {},
        duration: function() {},
        gui: function() {},
        noSolution: function() {},
        option: function(a, e) {
            var g = a;
            if (0 === arguments.length) return j.extend(true, {}, this.options);
            if ("string" === typeof a) {
                var k = a.split(".");
                if (e === f) {
                    g = j.extend(true, {}, this.options);
                    for (var l = 0; l < k.length; l++)
                        if (g[k[l]] !== f) g = g[k[l]];
                        else return this._warning({
                            type: j.jPlayer.warning.OPTION_KEY,
                            context: a,
                            message: j.jPlayer.warningMsg.OPTION_KEY,
                            hint: j.jPlayer.warningHint.OPTION_KEY
                        }), f;
                    return g
                }
                l = g = {};
                for (var o = 0; o < k.length; o++) o < k.length - 1 ? (l[k[o]] = {}, l = l[k[o]]) : l[k[o]] = e
            }
            this._setOptions(g);
            return this
        },
        _setOptions: function(a) {
            var e = this;
            j.each(a, function(g, k) {
                e._setOption(g, k)
            });
            return this
        },
        _setOption: function(a, e) {
            var g = this;
            switch (a) {
                case "volume":
                    this.volume(e);
                    break;
                case "muted":
                    this._muted(e);
                    break;
                case "cssSelectorAncestor":
                    this._cssSelectorAncestor(e);
                    break;
                case "cssSelector":
                    j.each(e, function(l, o) {
                        g._cssSelector(l, o)
                    });
                    break;
                case "fullScreen":
                    if (this.options[a] !== e) {
                        var k = j.jPlayer.nativeFeatures.fullscreen.used.webkitVideo;
                        if (!k || k && !this.status.waitForPlay) {
                            k || (this.options[a] = e);
                            e ? this._requestFullscreen() : this._exitFullscreen();
                            k || this._setOption("fullWindow", e)
                        }
                    }
                    break;
                case "fullWindow":
                    this.options[a] !== e && (this._removeUiClass(), this.options[a] =
                        e, this._refreshSize());
                    break;
                case "size":
                    !this.options.fullWindow && this.options[a].cssClass !== e.cssClass && this._removeUiClass();
                    this.options[a] = j.extend({}, this.options[a], e);
                    this._refreshSize();
                    break;
                case "sizeFull":
                    this.options.fullWindow && this.options[a].cssClass !== e.cssClass && this._removeUiClass();
                    this.options[a] = j.extend({}, this.options[a], e);
                    this._refreshSize();
                    break;
                case "autohide":
                    this.options[a] = j.extend({}, this.options[a], e);
                    this._updateAutohide();
                    break;
                case "loop":
                    this._loop(e);
                    break;
                case "nativeVideoControls":
                    this.options[a] =
                        j.extend({}, this.options[a], e);
                    this.status.nativeVideoControls = this._uaBlocklist(this.options.nativeVideoControls);
                    this._restrictNativeVideoControls();
                    this._updateNativeVideoControls();
                    break;
                case "noFullWindow":
                    this.options[a] = j.extend({}, this.options[a], e);
                    this.status.nativeVideoControls = this._uaBlocklist(this.options.nativeVideoControls);
                    this.status.noFullWindow = this._uaBlocklist(this.options.noFullWindow);
                    this._restrictNativeVideoControls();
                    this._updateButtons();
                    break;
                case "noVolume":
                    this.options[a] =
                        j.extend({}, this.options[a], e);
                    this.status.noVolume = this._uaBlocklist(this.options.noVolume);
                    this._updateVolume();
                    this._updateMute();
                    break;
                case "emulateHtml":
                    this.options[a] !== e && ((this.options[a] = e) ? this._emulateHtmlBridge() : this._destroyHtmlBridge());
                    break;
                case "timeFormat":
                    this.options[a] = j.extend({}, this.options[a], e);
                    break;
                case "keyEnabled":
                    this.options[a] = e;
                    !e && this === j.jPlayer.focus && (j.jPlayer.focus = null);
                    break;
                case "keyBindings":
                    this.options[a] = j.extend(true, {}, this.options[a], e);
                    break;
                case "audioFullScreen":
                    this.options[a] =
                        e
            }
            return this
        },
        _refreshSize: function() {
            this._setSize();
            this._addUiClass();
            this._updateSize();
            this._updateButtons();
            this._updateAutohide();
            this._trigger(j.jPlayer.event.resize)
        },
        _setSize: function() {
            this.options.fullWindow ? (this.status.width = this.options.sizeFull.width, this.status.height = this.options.sizeFull.height, this.status.cssClass = this.options.sizeFull.cssClass) : (this.status.width = this.options.size.width, this.status.height = this.options.size.height, this.status.cssClass = this.options.size.cssClass);
            this.element.css({
                width: this.status.width,
                height: this.status.height
            })
        },
        _addUiClass: function() {
            this.ancestorJq.length && this.ancestorJq.addClass(this.status.cssClass)
        },
        _removeUiClass: function() {
            this.ancestorJq.length && this.ancestorJq.removeClass(this.status.cssClass)
        },
        _updateSize: function() {
            this.internal.poster.jq.css({
                width: this.status.width,
                height: this.status.height
            });
            !this.status.waitForPlay && this.html.active && this.status.video || this.html.video.available && this.html.used && this.status.nativeVideoControls ?
                this.internal.video.jq.css({
                    width: this.status.width,
                    height: this.status.height
                }) : !this.status.waitForPlay && this.flash.active && this.status.video && this.internal.flash.jq.css({
                    width: this.status.width,
                    height: this.status.height
                })
        },
        _updateAutohide: function() {
            var a = this,
                e = function() {
                    a.css.jq.gui.fadeIn(a.options.autohide.fadeIn, function() {
                        clearTimeout(a.internal.autohideId);
                        a.internal.autohideId = setTimeout(function() {
                            a.css.jq.gui.fadeOut(a.options.autohide.fadeOut)
                        }, a.options.autohide.hold)
                    })
                };
            this.css.jq.gui.length &&
                (this.css.jq.gui.stop(true, true), clearTimeout(this.internal.autohideId), this.element.unbind(".jPlayerAutohide"), this.css.jq.gui.unbind(".jPlayerAutohide"), this.status.nativeVideoControls ? this.css.jq.gui.hide() : this.options.fullWindow && this.options.autohide.full || !this.options.fullWindow && this.options.autohide.restored ? (this.element.bind("mousemove.jPlayer.jPlayerAutohide", e), this.css.jq.gui.bind("mousemove.jPlayer.jPlayerAutohide", e), this.css.jq.gui.hide()) : this.css.jq.gui.show())
        },
        fullScreen: function() {
            this._setOption("fullScreen",
                true)
        },
        restoreScreen: function() {
            this._setOption("fullScreen", false)
        },
        _fullscreenAddEventListeners: function() {
            var a = this,
                e = j.jPlayer.nativeFeatures.fullscreen;
            e.api.fullscreenEnabled && e.event.fullscreenchange && ("function" !== typeof this.internal.fullscreenchangeHandler && (this.internal.fullscreenchangeHandler = function() {
                a._fullscreenchange()
            }), document.addEventListener(e.event.fullscreenchange, this.internal.fullscreenchangeHandler, false))
        },
        _fullscreenRemoveEventListeners: function() {
            var a = j.jPlayer.nativeFeatures.fullscreen;
            this.internal.fullscreenchangeHandler && document.addEventListener(a.event.fullscreenchange, this.internal.fullscreenchangeHandler, false)
        },
        _fullscreenchange: function() {
            this.options.fullScreen && !j.jPlayer.nativeFeatures.fullscreen.api.fullscreenElement() && this._setOption("fullScreen", false)
        },
        _requestFullscreen: function() {
            var a = this.ancestorJq.length ? this.ancestorJq[0] : this.element[0],
                e = j.jPlayer.nativeFeatures.fullscreen;
            e.used.webkitVideo && (a = this.htmlElement.video);
            e.api.fullscreenEnabled && e.api.requestFullscreen(a)
        },
        _exitFullscreen: function() {
            var a = j.jPlayer.nativeFeatures.fullscreen,
                e;
            a.used.webkitVideo && (e = this.htmlElement.video);
            a.api.fullscreenEnabled && a.api.exitFullscreen(e)
        },
        _html_initMedia: function(a) {
            var e = j(this.htmlElement.media).empty();
            j.each(a.track || [], function(g, k) {
                var l = document.createElement("track");
                l.setAttribute("kind", k.kind ? k.kind : "");
                l.setAttribute("src", k.src ? k.src : "");
                l.setAttribute("srclang", k.srclang ? k.srclang : "");
                l.setAttribute("label", k.label ? k.label : "");
                k.def && l.setAttribute("default",
                    k.def);
                e.append(l)
            });
            this.htmlElement.media.src = this.status.src;
            "none" !== this.options.preload && this._html_load();
            this._trigger(j.jPlayer.event.timeupdate)
        },
        _html_setFormat: function(a) {
            var e = this;
            j.each(this.formats, function(g, k) {
                if (e.html.support[k] && a[k]) return e.status.src = a[k], e.status.format[k] = true, e.status.formatType = k, false
            })
        },
        _html_setAudio: function(a) {
            this._html_setFormat(a);
            this.htmlElement.media = this.htmlElement.audio;
            this._html_initMedia(a)
        },
        _html_setVideo: function(a) {
            this._html_setFormat(a);
            this.status.nativeVideoControls && (this.htmlElement.video.poster = this._validString(a.poster) ? a.poster : "");
            this.htmlElement.media = this.htmlElement.video;
            this._html_initMedia(a)
        },
        _html_resetMedia: function() {
            this.htmlElement.media && (this.htmlElement.media.id === this.internal.video.id && !this.status.nativeVideoControls && this.internal.video.jq.css({
                width: "0px",
                height: "0px"
            }), this.htmlElement.media.pause())
        },
        _html_clearMedia: function() {
            this.htmlElement.media && (this.htmlElement.media.src = "about:blank", this.htmlElement.media.load())
        },
        _html_load: function() {
            this.status.waitForLoad && (this.status.waitForLoad = false, this.htmlElement.media.load());
            clearTimeout(this.internal.htmlDlyCmdId)
        },
        _html_play: function(a) {
            var e = this,
                g = this.htmlElement.media;
            this._html_load();
            if (isNaN(a)) g.play();
            else {
                this.internal.cmdsIgnored && g.play();
                try {
                    if (!g.seekable || "object" === typeof g.seekable && 0 < g.seekable.length) {
                        g.currentTime = a;
                        g.play()
                    } else throw 1;
                } catch (k) {
                    this.internal.htmlDlyCmdId = setTimeout(function() {
                        e.play(a)
                    }, 250);
                    return
                }
            }
            this._html_checkWaitForPlay()
        },
        _html_pause: function(a) {
            var e = this,
                g = this.htmlElement.media;
            0 < a ? this._html_load() : clearTimeout(this.internal.htmlDlyCmdId);
            g.pause();
            if (!isNaN(a)) try {
                if (!g.seekable || "object" === typeof g.seekable && 0 < g.seekable.length) g.currentTime = a;
                else throw 1;
            } catch (k) {
                this.internal.htmlDlyCmdId = setTimeout(function() {
                    e.pause(a)
                }, 250);
                return
            }
            0 < a && this._html_checkWaitForPlay()
        },
        _html_playHead: function(a) {
            var e = this,
                g = this.htmlElement.media;
            this._html_load();
            try {
                if ("object" === typeof g.seekable && 0 < g.seekable.length) g.currentTime =
                    a * g.seekable.end(g.seekable.length - 1) / 100;
                else if (0 < g.duration && !isNaN(g.duration)) g.currentTime = a * g.duration / 100;
                else throw "e";
            } catch (k) {
                this.internal.htmlDlyCmdId = setTimeout(function() {
                    e.playHead(a)
                }, 250);
                return
            }
            this.status.waitForLoad || this._html_checkWaitForPlay()
        },
        _html_checkWaitForPlay: function() {
            this.status.waitForPlay && (this.status.waitForPlay = false, this.css.jq.videoPlay.length && this.css.jq.videoPlay.hide(), this.status.video && (this.internal.poster.jq.hide(), this.internal.video.jq.css({
                width: this.status.width,
                height: this.status.height
            })))
        },
        _html_volume: function(a) {
            this.html.audio.available && (this.htmlElement.audio.volume = a);
            this.html.video.available && (this.htmlElement.video.volume = a)
        },
        _html_mute: function(a) {
            this.html.audio.available && (this.htmlElement.audio.muted = a);
            this.html.video.available && (this.htmlElement.video.muted = a)
        },
        _flash_setAudio: function(a) {
            var e = this;
            try {
                j.each(this.formats, function(k, l) {
                    if (e.flash.support[l] && a[l]) {
                        switch (l) {
                            case "m4a":
                            case "fla":
                                e._getMovie().fl_setAudio_m4a(a[l]);
                                break;
                            case "mp3":
                                e._getMovie().fl_setAudio_mp3(a[l]);
                                break;
                            case "rtmpa":
                                e._getMovie().fl_setAudio_rtmp(a[l])
                        }
                        e.status.src = a[l];
                        e.status.format[l] = true;
                        e.status.formatType = l;
                        return false
                    }
                });
                "auto" === this.options.preload && (this._flash_load(), this.status.waitForLoad = false)
            } catch (g) {
                this._flashError(g)
            }
        },
        _flash_setVideo: function(a) {
            var e = this;
            try {
                j.each(this.formats, function(k, l) {
                    if (e.flash.support[l] && a[l]) {
                        switch (l) {
                            case "m4v":
                            case "flv":
                                e._getMovie().fl_setVideo_m4v(a[l]);
                                break;
                            case "rtmpv":
                                e._getMovie().fl_setVideo_rtmp(a[l])
                        }
                        e.status.src =
                            a[l];
                        e.status.format[l] = true;
                        e.status.formatType = l;
                        return false
                    }
                });
                "auto" === this.options.preload && (this._flash_load(), this.status.waitForLoad = false)
            } catch (g) {
                this._flashError(g)
            }
        },
        _flash_resetMedia: function() {
            this.internal.flash.jq.css({
                width: "0px",
                height: "0px"
            });
            this._flash_pause(NaN)
        },
        _flash_clearMedia: function() {
            try {
                this._getMovie().fl_clearMedia()
            } catch (a) {
                this._flashError(a)
            }
        },
        _flash_load: function() {
            try {
                this._getMovie().fl_load()
            } catch (a) {
                this._flashError(a)
            }
            this.status.waitForLoad = false
        },
        _flash_play: function(a) {
            try {
                this._getMovie().fl_play(a)
            } catch (e) {
                this._flashError(e)
            }
            this.status.waitForLoad =
                false;
            this._flash_checkWaitForPlay()
        },
        _flash_pause: function(a) {
            try {
                this._getMovie().fl_pause(a)
            } catch (e) {
                this._flashError(e)
            }
            0 < a && (this.status.waitForLoad = false, this._flash_checkWaitForPlay())
        },
        _flash_playHead: function(a) {
            try {
                this._getMovie().fl_play_head(a)
            } catch (e) {
                this._flashError(e)
            }
            this.status.waitForLoad || this._flash_checkWaitForPlay()
        },
        _flash_checkWaitForPlay: function() {
            this.status.waitForPlay && (this.status.waitForPlay = false, this.css.jq.videoPlay.length && this.css.jq.videoPlay.hide(), this.status.video &&
                (this.internal.poster.jq.hide(), this.internal.flash.jq.css({
                    width: this.status.width,
                    height: this.status.height
                })))
        },
        _flash_volume: function(a) {
            try {
                this._getMovie().fl_volume(a)
            } catch (e) {
                this._flashError(e)
            }
        },
        _flash_mute: function(a) {
            try {
                this._getMovie().fl_mute(a)
            } catch (e) {
                this._flashError(e)
            }
        },
        _getMovie: function() {
            return document[this.internal.flash.id]
        },
        _getFlashPluginVersion: function() {
            var a = 0,
                e;
            if (window.ActiveXObject) try {
                if (e = new ActiveXObject("ShockwaveFlash.ShockwaveFlash")) {
                    var g = e.GetVariable("$version");
                    g && (g = g.split(" ")[1].split(","), a = parseInt(g[0], 10) + "." + parseInt(g[1], 10))
                }
            } catch (k) {} else navigator.plugins && 0 < navigator.mimeTypes.length && navigator.plugins["Shockwave Flash"] && (a = navigator.plugins["Shockwave Flash"].description.replace(/.*\s(\d+\.\d+).*/, "$1"));
            return 1 * a
        },
        _checkForFlash: function(a) {
            var e = false;
            this._getFlashPluginVersion() >= a && (e = true);
            return e
        },
        _validString: function(a) {
            return a && "string" === typeof a
        },
        _limitValue: function(a, e, g) {
            return a < e ? e : a > g ? g : a
        },
        _urlNotSetError: function(a) {
            this._error({
                type: j.jPlayer.error.URL_NOT_SET,
                context: a,
                message: j.jPlayer.errorMsg.URL_NOT_SET,
                hint: j.jPlayer.errorHint.URL_NOT_SET
            })
        },
        _flashError: function(a) {
            var e;
            e = this.internal.ready ? "FLASH_DISABLED" : "FLASH";
            this._error({
                type: j.jPlayer.error[e],
                context: this.internal.flash.swf,
                message: j.jPlayer.errorMsg[e] + a.message,
                hint: j.jPlayer.errorHint[e]
            });
            this.internal.flash.jq.css({
                width: "1px",
                height: "1px"
            })
        },
        _error: function(a) {
            this._trigger(j.jPlayer.event.error, a);
            this.options.errorAlerts && this._alert("Error!" + (a.message ? "\n\n" + a.message : "") + (a.hint ?
                "\n\n" + a.hint : "") + "\n\nContext: " + a.context)
        },
        _warning: function(a) {
            this._trigger(j.jPlayer.event.warning, f, a);
            this.options.warningAlerts && this._alert("Warning!" + (a.message ? "\n\n" + a.message : "") + (a.hint ? "\n\n" + a.hint : "") + "\n\nContext: " + a.context)
        },
        _alert: function(a) {
            alert("jPlayer " + this.version.script + " : id='" + this.internal.self.id + "' : " + a)
        },
        _emulateHtmlBridge: function() {
            var a = this;
            j.each(j.jPlayer.emulateMethods.split(/\s+/g), function(e, g) {
                a.internal.domNode[g] = function(k) {
                    a[g](k)
                }
            });
            j.each(j.jPlayer.event,
                function(e, g) {
                    var k = true;
                    j.each(j.jPlayer.reservedEvent.split(/\s+/g), function(l, o) {
                        if (o === e) return k = false
                    });
                    k && a.element.bind(g + ".jPlayer.jPlayerHtml", function() {
                        a._emulateHtmlUpdate();
                        var l = document.createEvent("Event");
                        l.initEvent(e, false, true);
                        a.internal.domNode.dispatchEvent(l)
                    })
                })
        },
        _emulateHtmlUpdate: function() {
            var a = this;
            j.each(j.jPlayer.emulateStatus.split(/\s+/g), function(e, g) {
                a.internal.domNode[g] = a.status[g]
            });
            j.each(j.jPlayer.emulateOptions.split(/\s+/g), function(e, g) {
                a.internal.domNode[g] =
                    a.options[g]
            })
        },
        _destroyHtmlBridge: function() {
            var a = this;
            this.element.unbind(".jPlayerHtml");
            j.each((j.jPlayer.emulateMethods + " " + j.jPlayer.emulateStatus + " " + j.jPlayer.emulateOptions).split(/\s+/g), function(e, g) {
                delete a.internal.domNode[g]
            })
        }
    };
    j.jPlayer.error = {
        FLASH: "e_flash",
        FLASH_DISABLED: "e_flash_disabled",
        NO_SOLUTION: "e_no_solution",
        NO_SUPPORT: "e_no_support",
        URL: "e_url",
        URL_NOT_SET: "e_url_not_set",
        VERSION: "e_version"
    };
    j.jPlayer.errorMsg = {
        FLASH: "jPlayer's Flash fallback is not configured correctly, or a command was issued before the jPlayer Ready event. Details: ",
        FLASH_DISABLED: "jPlayer's Flash fallback has been disabled by the browser due to the CSS rules you have used. Details: ",
        NO_SOLUTION: "No solution can be found by jPlayer in this browser. Neither HTML nor Flash can be used.",
        NO_SUPPORT: "It is not possible to play any media format provided in setMedia() on this browser using your current options.",
        URL: "Media URL could not be loaded.",
        URL_NOT_SET: "Attempt to issue media playback commands, while no media url is set.",
        VERSION: "jPlayer " + j.jPlayer.prototype.version.script +
            " needs Jplayer.swf version " + j.jPlayer.prototype.version.needFlash + " but found "
    };
    j.jPlayer.errorHint = {
        FLASH: "Check your swfPath option and that Jplayer.swf is there.",
        FLASH_DISABLED: "Check that you have not display:none; the jPlayer entity or any ancestor.",
        NO_SOLUTION: "Review the jPlayer options: support and supplied.",
        NO_SUPPORT: "Video or audio formats defined in the supplied option are missing.",
        URL: "Check media URL is valid.",
        URL_NOT_SET: "Use setMedia() to set the media URL.",
        VERSION: "Update jPlayer files."
    };
    j.jPlayer.warning = {
        CSS_SELECTOR_COUNT: "e_css_selector_count",
        CSS_SELECTOR_METHOD: "e_css_selector_method",
        CSS_SELECTOR_STRING: "e_css_selector_string",
        OPTION_KEY: "e_option_key"
    };
    j.jPlayer.warningMsg = {
        CSS_SELECTOR_COUNT: "The number of css selectors found did not equal one: ",
        CSS_SELECTOR_METHOD: "The methodName given in jPlayer('cssSelector') is not a valid jPlayer method.",
        CSS_SELECTOR_STRING: "The methodCssSelector given in jPlayer('cssSelector') is not a String or is empty.",
        OPTION_KEY: "The option requested in jPlayer('option') is undefined."
    };
    j.jPlayer.warningHint = {
        CSS_SELECTOR_COUNT: "Check your css selector and the ancestor.",
        CSS_SELECTOR_METHOD: "Check your method name.",
        CSS_SELECTOR_STRING: "Check your css selector is a string.",
        OPTION_KEY: "Check your option name."
    }
});

function Accordion(j) {
    window[j] = this;
    var f = this,
        h, b, c, d, a;
    f.initialize = function() {
        h = f.settings.cssClasses.expandedSectionHeader;
        b = f.settings.cssClasses.sectionHeader;
        c = f.settings.onSectionSlideDown;
        d = f.settings.onSectionSlideUp;
        a = f.settings.onInitComplete;
        $.each(f.foldableSections(), function(e, g) {
            $("#" + g.headerLink + ", #" + g.header).click(function() {
                f.handleSectionClick(g)
            })
        });
        a != null && $(document).trigger(a, f)
    };
    f.foldableSections = function() {
        return $(f.sections).filter(function(e, g) {
            return g.isFoldable
        })
    };
    f.handleSectionClick = function(e) {
        e.isExpanded ? f.collapseSection(e) : f.expandSection(e)
    };
    f.expandSection = function(e) {
        $("#" + e.header).removeClass(b).addClass(h);
        $("#" + e.content).slideDown(f.settings.animationDuration, function() {
            c != null && $(document).trigger(c, e.content)
        });
        e.isExpanded = !e.isExpanded
    };
    f.collapseSection = function(e) {
        $("#" + e.header).removeClass(h).addClass(b);
        $("#" + e.content).slideUp(f.settings.animationDuration, function() {
            d != null && $(document).trigger(d, e.content)
        });
        e.isExpanded = !e.isExpanded
    };
    return f
}

function AccordionGrid(j) {
    window[j] = this;
    var f = this;
    this.expandedRowCssClass = this.hiddenGridCssClass = null;
    this.subGridClientIds = [];
    f.toggleAccordionGrid = function(h, b) {
        var c = $("." + h).parent("li");
        if (c.hasClass(f.hiddenGridCssClass) || b == undefined) {
            $("." + h).get(0).tagName != "UL" && $(f.subGridClientIds).each(function() {
                this.cssClass == h && this.totalCount < 1 && this.refresh()
            });
            $(b).addClass(f.expandedRowCssClass);
            c.removeClass(f.hiddenGridCssClass)
        } else {
            $(b).removeClass(f.expandedRowCssClass);
            c.addClass(f.hiddenGridCssClass)
        }
    };
    f.reOpenOnPostBack =
        function(h, b) {
            h != "" && h != undefined && f.toggleAccordionGrid(h);
            b != "" && b != undefined && f.toggleAccordionGrid(b)
        };
    f.getSelectedValues = function() {
        var h = false;
        $(f.subGridClientIds).each(function() {
            if (this.getSelectedValues().length > 0) h = true
        });
        if (h) return true;
        return ""
    }
}

function Calendar(j) {
    window[j] = this;
    var f = this,
        h, b, c, d;
    f.initialize = function() {
        b = f.settings;
        c = f.customSettings;
        d = f.customScripts;
        h = f.calendar;
        $.extend(b, {
            select: d.onSelect,
            eventRender: d.eventRender,
            dayRender: d.dayRender,
            eventDrop: d.eventDrop,
            eventResize: d.eventResize,
            eventClick: d.eventClick,
            loading: d.loading,
            weekNumberCalculation: function(a) {
                var e = h.fullCalendar("getView");
                if (e && e.name == window.fullCalendarViews.agendaDay) return "";
                return Calendar.getWeekNumber(a, b.firstDay)
            },
            viewChange: d.onChangeView,
            viewRender: function(a) {
                h.fullCalendar("option", "contentHeight", a.name == window.fullCalendarViews.month ? NaN : 2500);
                d.viewRender(a)
            },
            updateTodayButton: d.updateTodayButton,
            eventAfterAllRender: d.eventAfterAllRender
        });
        h.fullCalendar(b)
    };
    f.refetchEvents = function(a, e) {
        var g = [];
        $.each(a, function(k, l) {
            g.push(l.id)
        });
        $.isFunction(e) && e(true);
        $.ajax({
            type: "POST",
            url: c.refetchEventsSource,
            data: {
                ids: g.join()
            },
            datatype: "json",
            success: function(k) {
                $.each(k, function(l, o) {
                    var n = $.grep(a, function(m) {
                        return m.id == o.id
                    })[0];
                    f.removeEvent(n.id);
                    n.source ? f.addEventForSource(o, n.source) : f.addEvent(o)
                });
                $.isFunction(e) && e(false)
            },
            error: function() {
                $.isFunction(e) && e(false)
            }
        })
    };
    f.refetchAll = function() {
        h.fullCalendar("refetchEvents")
    };
    f.removeEvent = function(a) {
        h.fullCalendar("removeEvents", a)
    };
    f.addEvent = function(a) {
        h.fullCalendar("renderEvent", a)
    };
    f.refetchSource = function(a) {
        h.fullCalendar("refetchSource", a)
    };
    f.refetchSourceByName = function(a) {
        a in f.eventSources && f.refetchSource(f.eventSources[a])
    };
    f.addEventForSource = function(a,
        e) {
        h.fullCalendar("renderEventForSource", a, e)
    };
    f.addEventForSourceByName = function(a, e) {
        e in f.eventSources && f.addEventForSource(a, f.eventSources[e])
    }
}
Calendar.getWeekNumber = function(j, f) {
    f = typeof f == "number" ? f : 1;
    f = f == 0 ? 7 : f;
    var h = Calendar.calculateWeekNumber(j, f);
    if (j.getMonth() == 11) {
        var b = new Date(j.getFullYear() + 1, 0, 1);
        if (f == 7) {
            b = new Date(j.getFullYear(), j.getMonth(), j.getDate() - j.getDay());
            if ((new Date(b.getFullYear(), b.getMonth(), b.getDate() + 6)).getFullYear() > b.getFullYear()) h = 1
        } else {
            b = b.getIsoDay();
            var c = new Date(j.getFullYear(), j.getMonth(), j.getDate() - (j.getIsoDay() - 1));
            if ((new Date(c.getFullYear(), c.getMonth(), c.getDate() + 6)).getFullYear() >
                c.getFullYear() && b < 5) h = 1
        }
    }
    if (h == 0) {
        h = new Date(j.getFullYear(), j.getMonth(), j.getDate() - 7);
        h = Calendar.calculateWeekNumber(h, f)
    }
    return h
};
Calendar.calculateWeekNumber = function(j, f) {
    var h = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
        b = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
    h = (new Date(j.getFullYear(), 1, 29)).getMonth() == 1 ? j.getDate() + b[j.getMonth()] : j.getDate() + h[j.getMonth()];
    b = j.getIsoDay();
    b = Calendar.getShiftBetweenNumbers(f, b);
    b = Calendar.shiftNumber(1, b);
    return Math.floor((h - b + (f == 7 ? 13 : 10)) / 7)
};
Calendar.getShiftBetweenNumbers = function(j, f) {
    for (var h = 0; h < 7; h++) {
        if (j == f) return h;
        j++;
        if (j == 8) j = 1
    }
    return 0
};
Calendar.shiftNumber = function(j, f) {
    if (f == 0) return j;
    for (var h = 0; h < f; h++) {
        j++;
        if (j == 8) j = 1
    }
    return j
};
Date.prototype.getIsoDay = function() {
    var j = this.getDay();
    return j == 0 ? 7 : j
};

function ClientInlineEditor(j, f, h, b, c, d, a) {
    if (j) {
        var e = this;
        e.isWatermarkMode = false;
        e.isGetInitialTextFromHidden = !!h;
        e.hiddenField = h;
        e.viewField = $(j);
        e.editModeActivator = f ? $(f) : e.viewField;
        e.editField = undefined;
        e.editHidden = undefined;
        e.editLink = $();
        e.onEditFunction = c;
        e.onChangeModeFunction = d;
        e.userData = a;
        e.options = $.extend({
            multiline: false,
            watermark: "",
            autoResize: false,
            clickToEditToolTip: "",
            clickToSaveToolTip: "",
            submitOnEnter: false,
            ignoreViewModeText: false,
            editFieldCssClass: "",
            watermarkCssClass: "",
            editFieldAutoWidth: true,
            editFieldDisplayInline: false,
            highlightOnSave: false,
            highlightOnFocus: false,
            maxLength: 0,
            renderRightLinkWithIcon: false,
            rightLinkCssClass: "",
            rightLinkViewModeCssClass: "",
            rightLinkEditModeCssClass: "",
            supressOriginalBehaviour: false
        }, b);
        e.options.useWatermark = !!e.options.watermark;
        e.options.useClickToEditToolTip = !!e.options.clickToEditToolTip;
        e.options.useEditFieldCssClass = !!e.options.editFieldCssClass;
        e.options.useWatermarkCssClass = !!e.options.watermarkCssClass;
        if (e.options.renderRightLinkWithIcon) {
            e.editLink =
                $("<a href='#'></a>").addClass(e.options.rightLinkCssClass).append($("<img alt='' />").attr("src", CommonConstants.onePixelTransparentImageSource)).insertAfter(e.viewField).click({
                    self: e
                }, e.rightLinkClick).keydown({
                    self: e
                }, e.rightLinkKeyDown);
            e.initDeviceChecks();
            e.toggleRightLinkMode(true, true)
        }
        e.options.supressOriginalBehaviour || e.editModeActivator.click($.proxy(e.switchToEditMode, e)).filter("a").keydown({
            self: e
        }, e.editModeActivatorKeyDown);
        e.toggleActivatorTooltip(true);
        return {
            switchToEditMode: function() {
                e.switchToEditMode();
                return e.editField
            },
            setNewText: function(g) {
                e.setNewText(g)
            },
            getEditFieldText: function() {
                return e.getEditFieldText()
            }
        }
    }
}
ClientInlineEditor.prototype = {
    isIos: undefined,
    hiddenCssClass: "h-hidden",
    createEditor: function(j) {
        this.options.renderRightLinkWithIcon || this.initDeviceChecks();
        this.editField = $(j.multiline ? "<textarea/>" : '<input type="text"/>').css("resize", "none").addClass(this.hiddenCssClass);
        j.editFieldAutoWidth && this.editField.width(this.viewField.width());
        j.useEditFieldCssClass && this.editField.addClass(j.editFieldCssClass);
        !j.multiline && j.maxLength && this.editField.attr("maxlength", j.maxLength);
        j.multiline && j.maxLength &&
            this.editField.maxlength({
                max: j.maxLength
            });
        this.editHidden = this.isGetInitialTextFromHidden ? $(this.hiddenField) : $('<input type="hidden"/>').val(this.viewField.text());
        this.setNewText(j.ignoreViewModeText ? "" : $.trim(this.editHidden.val()));
        this.viewField.after(this.editField);
        this.isGetInitialTextFromHidden || this.viewField.after(this.editHidden);
        j.multiline && j.autoResize && this.editField.autogrow();
        this.switchToViewMode(false);
        this.editField.removeClass(this.hiddenCssClass).keyup({
            self: this
        }, this.editFieldKeyUp).keypress({
                self: this
            },
            this.editFieldKeyPress).on("paste", $.proxy(this.hideWatermark, this)).focus({
            self: this
        }, this.editFieldFocus).blur({
            self: this
        }, this.editFieldBlur)
    },
    setNewText: function(j) {
        if (!this.options.ignoreViewModeText && !this.options.supressOriginalBehaviour)
            if (j) this.options.multiline ? this.viewField.html(CommonFunctions.replaceLineBreaksWithBrTags(j.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/  /g, " &nbsp;"))) : this.viewField.text(j);
            else this.viewField.html("");
        this.editField || this.createEditor(this.options);
        this.editField.val(j);
        this.editHidden.val(j)
    },
    switchToViewMode: function(j, f) {
        this.editField.hide();
        j && this.options.highlightOnSave ? this.viewField.fadeIn("slow") : this.viewField.show();
        this.toggleActivatorTooltip(true);
        this.fireChangeMode(false, j, f);
        this.toggleRightLinkMode(true)
    },
    switchToEditMode: function() {
        this.editField || this.createEditor(this.options);
        if (this.isViewMode()) {
            this.viewField.hide();
            this.editField.show();
            this.options.editFieldDisplayInline && this.editField.css("display", "inline");
            this.toggleActivatorTooltip(false);
            this.fireChangeMode(true, false);
            this.editField.focus();
            this.toggleRightLinkMode(false)
        }
    },
    fireChangeMode: function(j, f, h) {
        if (this.onChangeModeFunction) {
            var b = this;
            setTimeout(function() {
                b.onChangeModeFunction({
                    isEditMode: j,
                    isNewTextSaved: f,
                    actualText: h,
                    source: b.viewField,
                    currentOptions: b.options,
                    userData: b.userData
                })
            })
        }
    },
    isViewMode: function() {
        return this.editField.is(":hidden")
    },
    updateText: function() {
        var j = this,
            f = {
                isUpdateSuccess: true,
                stopOnEdit: false,
                actualText: j.isWatermarkMode ? "" : j.editField.val(),
                source: j.viewField,
                currentOptions: j.options,
                userData: j.userData
            };
        if (f.actualText === j.editHidden.val()) setTimeout(function() {
            j.switchToViewMode(false)
        }, j.options.renderRightLinkWithIcon ? 100 : 0);
        else {
            j.toggleEditField(false);
            j.onEditFunction ? j.onEditFunction(f, $.proxy(j.onUpdateComplete, j)) : setTimeout(function() {
                j.onUpdateComplete(f)
            })
        }
    },
    onUpdateComplete: function(j) {
        this.toggleEditField(true);
        if (j.isUpdateSuccess) {
            this.setNewText(j.actualText);
            this.switchToViewMode(true, j.actualText)
        } else j.stopOnEdit ||
            this.rollbackText()
    },
    rollbackText: function() {
        this.editField.val(this.editHidden.val());
        this.switchToViewMode(false)
    },
    toggleEditField: function(j) {
        this.editField.prop("disabled", !j)
    },
    toggleActivatorTooltip: function(j) {
        this.editModeActivator.css("cursor", j ? "pointer" : "default");
        if (this.options.useClickToEditToolTip) this.editModeActivator.attr("title", j ? this.options.clickToEditToolTip : null)
    },
    isEnterKeyAndNeedToSubmit: function(j) {
        return this.options.submitOnEnter && j.which === CommonConstants.keyCodes.enter &&
            !j.shiftKey
    },
    showWatermark: function() {
        if (!(!this.options.useWatermark || this.isWatermarkMode || this.editField.val())) {
            this.options.useWatermarkCssClass && this.editField.addClass(this.options.watermarkCssClass);
            this.editField.val(this.options.watermark);
            this.isWatermarkMode = true
        }
    },
    hideWatermark: function() {
        if (this.options.useWatermark && this.isWatermarkMode) {
            this.options.useWatermarkCssClass && this.editField.removeClass(this.options.watermarkCssClass);
            this.editField.val("");
            this.isWatermarkMode = false
        }
    },
    editModeActivatorKeyDown: function(j) {
        var f = j.data.self;
        f.fireClickByKeyDown(j, f.editModeActivator)
    },
    rightLinkKeyDown: function(j) {
        var f = j.data.self;
        f.fireClickByKeyDown(j, f.editLink)
    },
    fireClickByKeyDown: function(j, f) {
        if (j.which === CommonConstants.keyCodes.enter) {
            j.preventDefault();
            setTimeout(function() {
                f.click()
            }, 400)
        }
    },
    editFieldFocus: function(j) {
        j = j.data.self;
        var f = j.editField.get(0);
        j.showWatermark();
        CommonFunctions.setFocusTo(f, !j.isWatermarkMode);
        if (j.options.highlightOnFocus) j.isIos ? f.setSelectionRange(0,
            f.value.length) : j.editField.select();
        j.options.multiline && j.options.autoResize && j.editField.change()
    },
    editFieldBlur: function(j) {
        j.data.self.updateTextOnBlur();
        j.stopPropagation()
    },
    updateTextOnBlur: function() {
        if (!this.editField.prop("disabled")) {
            this.hideWatermark();
            this.updateText()
        }
    },
    editFieldKeyUp: function(j) {
        var f = j.data.self;
        if (!f.isViewMode()) {
            if (f.editField.prop("disabled")) return true;
            if (j.which === CommonConstants.keyCodes.escape) f.rollbackText();
            else if (f.isEnterKeyAndNeedToSubmit(j)) {
                j.stopPropagation();
                f.updateText();
                return false
            }
        }
        return true
    },
    editFieldKeyPress: function(j) {
        var f = j.data.self;
        f.hideWatermark();
        return !f.isEnterKeyAndNeedToSubmit(j)
    },
    initDeviceChecks: function() {
        this.isAndroidDevice = (this.isIos = CommonFunctions.isIos()) ? false : CommonFunctions.isAndroidDevice()
    },
    rightLinkClick: function(j) {
        var f = j.data.self;
        if (!f.editField || f.isViewMode()) f.switchToEditMode();
        else f.isIos && f.updateTextOnBlur();
        j.preventDefault()
    },
    toggleRightLinkMode: function(j, f) {
        this.editLink.toggleClass(this.options.rightLinkEditModeCssClass, !j).prop("title", j ? this.options.clickToEditToolTip : this.options.clickToSaveToolTip);
        !this.isIos && !this.isAndroidDevice && this.editLink.toggleClass(this.options.rightLinkViewModeCssClass, j);
        j && !f && this.editLink.focus().blur()
    },
    getEditFieldText: function() {
        return this.editField.val()
    }
};

function ColorPicker(j) {
    function f(m) {
        m = $(m).find("input:hidden:first").val();
        b(m)
    }

    function h() {
        var m = l.find("li." + e.settings.cssClasses.selected + " input:hidden:first").val();
        b(m)
    }

    function b(m) {
        g.trigger(e.settings.clientEvents.colorOver, m)
    }

    function c(m) {
        if (m.which === CommonConstants.keyCodes.escape) {
            h();
            d()
        }
        return true
    }

    function d(m) {
        k.hide();
        o.hide();
        m && g.focus()
    }

    function a() {
        o = $("<div></div>").addClass(e.settings.cssClasses.popupTop).appendTo("form").keydown(function(B) {
            return c(B || window.event)
        });
        n = g.clone(false).appendTo(o).click(function() {
            d();
            return false
        });
        k = $("<div></div>").addClass(e.settings.cssClasses.popup).addClass(e.settings.cssClasses.customPopup).appendTo("form").keydown(function(B) {
            return c(B || window.event)
        });
        l = $("<ul></ul>").appendTo(k);
        for (var m = 0; m < e.settings.colorKeys.length; m++) {
            var p = e.settings.colorKeys[m],
                r = $("<li></li>").append($('<input type="hidden" />').val(p)).append($("<a></a>").attr("href", "#").html("&nbsp;").addClass(e.settings.colors[p].PickerColorCssClass)).appendTo(l);
            p == e.settings.selectedColorKey && r.addClass(e.settings.cssClasses.selected)
        }
    }
    window[j] = this;
    var e = this,
        g, k, l, o, n;
    e.initialize = function() {
        g = e.controls.pickerLink;
        a();
        $(document).click(function(p) {
            p = p ? p : window.event;
            var r = p.srcElement || p.target;
            if (k.length && !k.is(":hidden") && r != g.get(0) && !$(r).parents().filter("#" + g.prop("id")).length) {
                r = k.offset();
                p.clientX > r.left && p.clientX < r.left + k.width() && p.clientY > r.top && p.clientY < r.top + k.height() || d()
            }
        }).on("closeColorPicker", function() {
            d(false)
        });
        var m = l.find("li");
        m.find("a").click(function() {
            var p = $(this.parentNode),
                r = p.find("input:hidden:first").val();
            d();
            m.removeClass(e.settings.cssClasses.selected);
            p.addClass(e.settings.cssClasses.selected);
            b(r);
            g.trigger(e.settings.clientEvents.colorChange, r);
            return false
        }).mouseenter(function() {
            f(this.parentNode)
        }).mouseleave(function() {
            h()
        }).focusin(function() {
            f(this.parentNode)
        }).focusout(function() {
            h()
        });
        g.click(function(p) {
            p.preventDefault();
            $(document).click();
            if (k.is(":hidden")) {
                p = g.offset();
                k.css({
                    top: p.top + g.height() -
                        1 + "px",
                    left: p.left - k.width() + g.width() + 3 + "px"
                }).show();
                p = k.offset();
                o.show().css({
                    top: p.top - o.height() + "px",
                    left: p.left + k.width() - o.width() + "px"
                });
                n.focus()
            } else d()
        })
    };
    e.getColorByKey = function(m) {
        return e.settings.colors[m].RepaintColorCssClass
    };
    return e
}
if (!Array.prototype.indexOf) Array.prototype.indexOf = function(j, f) {
    for (var h = f || 0, b = this.length; h < b; h++)
        if (this[h] === j) return h;
    return -1
};
Array.prototype.remove = function() {
    for (var j, f = arguments, h = f.length, b; h && this.length;)
        for (j = f[--h];
            (b = this.indexOf(j)) != -1;) this.splice(b, 1);
    return this
};
if (!String.format) String.format = function(j) {
    var f = Array.prototype.slice.call(arguments, 1);
    return j.replace(/\{(\d+)\}/g, function(h, b) {
        return b in f ? f[b] : h
    })
};
var CommonConstants = {
        keyCodes: {
            backspace: 8,
            enter: 13,
            escape: 27,
            space: 32,
            arrowUp: 38,
            arrowDown: 40,
            del: 46
        },
        mediaScreenSizes: {
            mobile: 568,
            iPadPortraitMode: 768
        },
        onePixelTransparentImageSource: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCB1jYAAAAAIAAc/INeUAAAAASUVORK5CYII="
    },
    CommonWindowMessages = {
        collapseContentAreaFrame: {
            messageName: "collapseContentAreaFrame"
        },
        expandContentAreaFrame: {
            messageName: "expandContentAreaFrame"
        },
        contentAreaFrameHasCollapsed: {
            messageName: "contentAreaFrameHasCollapsed"
        },
        contentAreaFrameHasExpanded: {
            messageName: "contentAreaFrameHasExpanded"
        },
        collapseExtensionIframe: {
            messageName: "collapseExtensionIframe"
        },
        expandExtensionIframe: {
            messageName: "expandExtensionIframe"
        },
        unreadNotificationCounterChanged: {
            messageName: "unreadNotificationCounterChanged",
            counter: 0
        },
        unreadMessageCounterChanged: {
            messageName: "unreadMessageCounterChanged",
            counter: 0
        }
    },
    CommonTriggers = {
        clickInInnerFrame: "clickInInnerFrame"
    },
    CommonFunctions = {
        setFocusTo: function(j, f) {
            if (j.setSelectionRange) {
                j.focus();
                var h = f ? j.value.length : 0;
                j.setSelectionRange(h, h)
            } else if (j.createTextRange) {
                h = j.createTextRange();
                f && h.collapse(false);
                h.select()
            }
        },
        makePostMessageCall: function(j, f) {
            j.postMessage(JSON.stringify(f), "*")
        },
        attachPostMessageEventListener: function(j, f, h) {
            j.on("message", function(b) {
                var c, d = b.originalEvent.source;
                if (b.originalEvent.data && (c = JSON.parse(b.originalEvent.data)) && c.messageName && (typeof f === "string" ? c.messageName === f : f.indexOf(c.messageName) != -1)) h(c, d)
            })
        },
        addIdToHidden: function(j, f) {
            if (j &&
                f) {
                for (var h = document.getElementById(j), b = h.value.split(","), c = false, d = 0; d < b.length; d++)
                    if (f == b[d]) {
                        c = true;
                        break
                    }
                c || (h.value += f + ",")
            }
        },
        removeIdFromHidden: function(j, f) {
            if (j && f) {
                var h = document.getElementById(j);
                if (h && h.value) {
                    for (var b = h.value.split(","), c = "", d = 0; d < b.length; d++)
                        if (f != b[d] && b[d].length > 0) c += b[d] + ",";
                    h.value = c
                }
            }
        },
        setupDropDownMenu: function(j, f, h) {
            var b = j ? "touchstart" : "click";
            h.find("a").click(function() {
                h.hide()
            });
            f.on(b + " keydown", function(c) {
                if (c.type === b || c.which === CommonConstants.keyCodes.arrowDown ||
                    c.which === CommonConstants.keyCodes.enter) h.toggle()
            });
            $(document).on(b + " " + CommonTriggers.clickInInnerFrame, function(c) {
                if (h.is(":visible")) {
                    var d = c.target,
                        a = $(d);
                    c = d === f.get(0) || a.closest(f).length === 1;
                    d = !c && (d === h.get(0) || a.closest(h).length === 1);
                    !c && !d && h.hide()
                }
            })
        },
        safeExecuteFunction: function(j) {
            if (j) try {
                return j()
            } catch (f) {}
            return true
        },
        htmlEncode: function(j) {
            return $("<div/>").text(j).html()
        },
        replaceLineBreaksWithBrTags: function(j) {
            return j.replace(/\r?\n/g, "<br />")
        },
        isPlainText: function(j) {
            var f =
                RegExp("^s*<[a-z]+>[^<]*</[a-z]+>(s|\n)*$", "ig");
            j = j.replace(/<br((\s*)|(\s[^>]*))\/?>/gi, "");
            j = j.replace(/<\/p>\s*<p(\s+[^>]*)?>/gi, "\n");
            return j.indexOf("<") == -1 || j.match(f) != null
        },
        isIos: function() {
            return navigator.userAgent.match(/iPod|iPhone|iPad/i) != null
        },
        isAndroidDevice: function() {
            return navigator.userAgent.match(/Android/i) != null
        },
        setEmbeddedObjectsVisibility: function(j, f, h) {
            if (f) f.find("applet")[j ? "show" : "hide"]();
            if (h) h.find("iframe,object").css("visibility", j ? "visible" : "hidden")
        },
        alertAjaxError: function(j) {
            j.status >=
                400 && j.responseText && alert($("<div/>").html(j.responseText).text())
        },
        getMessageCountTemplate: function(j, f) {
            return f ? " (" + j + ")" : j >= 100 ? "99+" : j
        }
    };
(function(j) {
    j.fn.setCursorPosition = function(f) {
        this.each(function(h, b) {
            if (b.setSelectionRange) b.setSelectionRange(f, f);
            else if (b.createTextRange) {
                var c = b.createTextRange();
                c.collapse(true);
                c.moveEnd("character", f);
                c.moveStart("character", f);
                c.select()
            }
        });
        return this
    };
    j.fn.scrollMinimal = function() {
        var f = this.offset().top,
            h = this.outerHeight(true),
            b = j(window).scrollTop(),
            c = j(window).height();
        if (f < b) j(window).scrollTop(f);
        else f + h > b + c && j(window).scrollTop(f - c + h)
    };
    j.fn.toggleHyperlink = function(f) {
        if (f) {
            this.removeAttr("disabled");
            this.removeData("disabled")
        } else {
            this.attr("disabled", "disabled");
            this.data("disabled", true)
        }
        return this
    };
    j.fn.getIfHyperLinkEnabled = function() {
        return this.attr("disabled") !== "disabled" && !this.data("disabled")
    };
    j.fn.maxlength = function(f) {
        f = j.extend({
            max: 200
        }, f);
        return this.each(function() {
            obj = j(this);
            obj.keypress(function(h) {
                var b = f.max,
                    c = j(h.target),
                    d = c.val().length;
                d = h.which;
                if (d >= CommonConstants.keyCodes.space || d === CommonConstants.keyCodes.enter) {
                    d = c.val().length;
                    d >= b && h.preventDefault()
                }
            });
            obj.change(function(h) {
                var b =
                    f.max;
                h = j(h.target);
                var c = h.val().length;
                c = h.val().length;
                if (c > b) {
                    b = h.val().substr(0, b);
                    h.val(b)
                }
            })
        })
    }
})(jQuery);

function ContextDialog(j, f) {
    var h = this,
        b = $(j),
        c, d = {
            setFocus: true,
            width: 300,
            showArrow: true,
            arrowOffset: "auto",
            align: "auto",
            valign: "auto",
            marginLeft: 10,
            marginRight: 10,
            marginTop: -40,
            marginBottom: 40,
            toggleElement: null,
            customScripts: {
                beforeCloseDialog: null
            }
        },
        a = b.wrap("<div class='ccl-context-dialog'></div>").parent(),
        e = a.parent(),
        g = $("<header class='ccl-context-dialog-header'></header>").prependTo(a),
        k = $("<a class='ccl-context-dialog-close' href='javascript:void(0);'>&#215;</a>").appendTo(g),
        l = $("<h2></h2>").appendTo(g),
        o = $("<div class='ccl-context-dialog-arrow'></div>").prependTo(a),
        n, m = $("html"),
        p = $("body"),
        r = $(window),
        B, ca;
    h.openDialogAt = function(z, S, ha) {
        function wa(Pa) {
            var gb = Pa - (ma - La - z - d.marginRight);
            if (gb > 0) {
                a.css({
                    left: z - Pa - gb - d.marginRight
                });
                o.css({
                    left: Pa + gb + d.marginRight
                })
            }
        }
        if (ha) z += e.width();
        else {
            z || (z = 0);
            S || (S = 0)
        }
        $(document).trigger("contextdialog:show", [b]);
        n = r.scrollTop();
        h.isMobileView = r.width() <= CommonConstants.mediaScreenSizes.mobile;
        m.addClass("ccl-context-dialog-has-overlay");
        o.toggle(d.showArrow);
        a.removeClass("top bottom left right");
        d.width && a.outerWidth(d.width);
        var La = e.position().left,
            ma = r.width();
        if (h.isMobileView && ha) {
            a.addClass("bottom");
            a.css({
                left: d.marginLeft - La,
                width: ma - d.marginLeft - d.marginRight
            });
            o.css({
                left: La - d.marginLeft + z
            })
        } else if (h.isMobileView) {
            CommonFunctions.makePostMessageCall(window.top, CommonWindowMessages.expandContentAreaFrame);
            IframeResizer.reportSetIframeDefaultHeight();
            if (window.top != window) try {
                var Ga = $(window.top).width();
                Ga < r.width() && p.outerWidth(Ga, true)
            } catch (qa) {}
        } else {
            var Ca,
                Ea;
            Ga = a.outerWidth();
            var Sa = a.outerHeight(),
                Wa = r.scrollLeft(),
                fb = r.scrollTop(),
                jb = r.width() + Wa;
            fb = r.height() + fb;
            if (d.align == "auto") Ea = jb - z > Ga + d.marginLeft ? z + d.marginLeft : z - Ga - d.marginRight;
            else if (d.align == "center") Ea = z - Ga / 2;
            else if (d.align == "left") Ea = z - Ga - d.marginRight;
            else if (d.align == "right") Ea = z + d.marginLeft;
            if (d.valign == "auto") Ca = fb - d.marginBottom - S > Sa + d.marginTop ? S + d.marginTop : fb - Sa - d.marginBottom;
            else if (d.valign == "top") Ca = S - Sa - d.marginBottom;
            else if (d.valign == "center") Ca = S - Sa / 2;
            else if (d.valign ==
                "bottom") Ca = S + d.marginTop;
            ha || (Ea = Ea < Wa ? Wa : Ea);
            a.css({
                top: Ca,
                left: Ea
            });
            var Xa, Oa;
            if (Ca < S && Ca + Sa > S) {
                Xa = "top";
                Oa = Math.max(0, Math.min(S - Ca, Sa - 12));
                if (Ea + Ga < z) a.addClass("left");
                else z < Ea && a.addClass("right")
            } else if (Ea < z && Ea + Ga > z) {
                Xa = "left";
                Oa = Math.max(0, Math.min(z - Ea, Ga - 12));
                if (Ca > S) a.addClass("bottom");
                else Ca + Sa + S && a.addClass("top")
            }
            if (d.arrowOffset == "auto")
                if (Xa == "top") o.css({
                    top: Oa,
                    left: ""
                });
                else Xa == "left" && o.css({
                    top: "",
                    left: Oa
                });
            else o.css({
                top: "",
                left: ""
            }); if (ha) {
                S = a.outerWidth() / 2;
                if (S - La >
                    0) {
                    a.css({
                        left: d.marginLeft - La
                    });
                    o.css({
                        left: La - d.marginLeft + z
                    })
                }
                wa(S);
                a.css("height", "");
                S = r.height() - (e.position().top + e.height() + d.marginBottom);
                S > 0 && a.height() > S && a.css("height", S)
            }
        }
        a.show();
        B = window.parent ? window.parent.document.activeElement : document.activeElement;
        d.setFocus && d.focusTarget && d.focusTarget.focus();
        c = true
    };
    h.openDialog = function(z) {
        var S = 0,
            ha = 0;
        if (z) {
            if (z.type == "touchend") {
                S = z.originalEvent.changedTouches[0];
                z.pageX = S.pageX;
                z.pageY = S.pageY
            }
            S = z.pageX;
            ha = z.pageY;
            z.stopPropagation()
        }
        h.openDialogAt(S,
            ha)
    };
    h.closeDialog = function() {
        CommonFunctions.safeExecuteFunction(d.customScripts.beforeCloseDialog);
        if (h.isMobileView) {
            CommonFunctions.makePostMessageCall(window.top, CommonWindowMessages.collapseContentAreaFrame);
            IframeResizer.reportSetIframeDefaultHeight();
            p.width("")
        }
        a.hide();
        m.removeClass("ccl-context-dialog-has-overlay");
        r.scrollTop(n);
        $(document).trigger("contextdialog:close", [b]);
        c = false;
        B && B.focus()
    };
    h.setTitle = function(z) {
        d.title = z;
        l.text(d.title)
    };
    h.showFooter = function() {
        ca && ca.show()
    };
    h.hideFooter = function() {
        ca && ca.hide()
    };
    h.showHeader = function() {
        g.show()
    };
    h.hideHeader = function() {
        g.hide()
    };
    h.isOpened = function() {
        return c
    };
    h.setBeforeCloseDialog = function(z) {
        d.customScripts.beforeCloseDialog = z
    };
    (function() {
        $.extend(d, f);
        l.uniqueId();
        a.attr({
            role: "dialog",
            "aria-labelledby": l.attr("id")
        });
        b.addClass("ccl-context-dialog-content");
        if (d.footerContent) {
            var z = $("#" + d.footerContent);
            ca = $("<footer class='ccl-context-dialog-footer'></footer>");
            ca.appendTo(a);
            z.appendTo(ca)
        }
        d.cssClass && a.addClass(d.cssClass);
        h.setTitle(d.title);
        b.show();
        k.click(h.closeDialog)
    })();
    $(function() {
        function z(ma) {
            if (c && $(ma.target).closest(a).length === 0) d.toggleElement && $(ma.target).closest(d.toggleElement).length > 0 || h.closeDialog()
        }

        function S(ma) {
            ma.which === CommonConstants.keyCodes.escape && h.closeDialog()
        }

        function ha(ma) {
            ma.each(function(Ga, qa) {
                if (qa.addEventListener) {
                    qa.addEventListener(La, z, true);
                    qa.addEventListener("keydown", S, true)
                } else {
                    $(qa).on(La, z);
                    $(qa).on("keydown", S)
                }
            })
        }
        var wa = $(window);
        if (window.parent) wa = wa.add(window.parent);
        var La = window.CommonFunctions.isIos() ? "touchstart" : "mousedown";
        ha(wa);
        $("iframe").on("load", function() {
            try {
                var ma = $(this.contentWindow || this.contentDocument);
                ha(ma)
            } catch (Ga) {}
        });
        $(document).on(CommonTriggers.clickInInnerFrame, function() {
            c && h.closeDialog()
        })
    });
    return h
}

function CssModal(j) {
    function f() {
        return r.closeButton.getIfHyperLinkEnabled() && (!ca || ca())
    }

    function h() {
        if (window.location.hash.replace("#", "") === o) return true;
        return false
    }

    function b() {
        $(document).off("cssmodal:hide", b);
        c()
    }

    function c() {
        if (h() && !m) {
            for (var qa = false, Ca = 0; Ca < CssModal.instances.length; Ca += 1) qa = qa || CssModal.instances[Ca].getIsOpened();
            if (qa) {
                $(document).on("cssmodal:hide", b);
                return
            }
            m = true;
            CommonFunctions.safeExecuteFunction(B.beforeOpenDialog);
            if (h() && m) {
                if (p.userInputControlsSelector) {
                    qa =
                        $(p.userInputControlsSelector);
                    CommonFunctions.setEmbeddedObjectsVisibility(false, qa, qa)
                }
                ha = wa.scrollTop();
                La.addClass(CssModal.commonSettings.cssClasses.overlay);
                p.isIos && La.addClass(CssModal.commonSettings.cssClasses.overlayIos);
                k(CommonWindowMessages.expandContentAreaFrame.messageName);
                if (window.top != window) try {
                    var Ea = $(window.top).width();
                    Ea < wa.width() && ma.outerWidth(Ea, true)
                } catch (Sa) {}
                $(S).removeClass(CssModal.commonSettings.cssClasses.isActive);
                r.container.addClass(CssModal.commonSettings.cssClasses.isActive);
                S = r.container.get(0);
                CssModal.modes.ajaxDynamically === n && e();
                CssModal.modes.iframeDynamically === n && g();
                if (S) {
                    z = document.activeElement;
                    S.focus()
                }
                $(document).trigger("cssmodal:show", [S, o]);
                CssModal.modes.ajaxDynamically !== n && CssModal.modes.iframeDynamically !== n && a()
            }
            CommonFunctions.safeExecuteFunction(B.afterOpenDialog)
        }
        if (!h() && m) {
            m = false;
            CommonFunctions.safeExecuteFunction(B.beforeCloseDialog);
            if (p.userInputControlsSelector) {
                Ea = $(p.userInputControlsSelector);
                CommonFunctions.setEmbeddedObjectsVisibility(true,
                    Ea, Ea)
            }
            La.removeClass(CssModal.commonSettings.cssClasses.overlay);
            p.isIos && La.removeClass(CssModal.commonSettings.cssClasses.overlayIos);
            wa.scrollTop(ha);
            if (S) {
                if (CssModal.modes.ajaxDynamically === n || CssModal.modes.iframeDynamically === n) r.contentContainer.html("");
                $(S).removeClass(CssModal.commonSettings.cssClasses.isActive);
                k(CommonWindowMessages.collapseContentAreaFrame.messageName);
                ma.width("");
                $(document).trigger("cssmodal:hide", [S, o]);
                S = null
            }
            l.setCloseConfirmation(null);
            z && z.focus();
            CommonFunctions.safeExecuteFunction(B.afterCloseDialog)
        }
    }

    function d() {
        Ga && clearTimeout(Ga);
        Ga = setTimeout(a, p.resizeTimeoutInMilliseconds)
    }

    function a() {
        if (h() && m) {
            r.innerContainer.removeAttr("style");
            r.contentContainer.removeAttr("style");
            if (wa.width() > CommonConstants.mediaScreenSizes.mobile) {
                if (l._maximized) r.innerContainer.css({
                    width: $(window).width(),
                    height: $(window).height(),
                    left: "0",
                    top: "0"
                });
                else {
                    p.preferredWidth && p.preferredWidth > 0 && r.innerContainer.width(Math.min(p.preferredWidth, wa.width() - 40));
                    p.preferredHeight && p.preferredHeight > 0 && r.contentContainer.outerHeight(p.preferredHeight,
                        true)
                }
                r.contentContainer.css({
                    width: p.minContentWidth && p.minContentWidth > 0 ? p.minContentWidth : undefined,
                    minWidth: p.minContentWidth && p.minContentWidth > 0 ? p.minContentWidth : undefined,
                    minHeight: p.minContentHeight && p.minContentHeight > 0 ? p.minContentHeight : undefined
                });
                var qa = r.innerContainer.height() - r.headerContainer.outerHeight() - r.footerContainer.outerHeight();
                if (l._maximized) r.contentContainer.outerHeight(qa);
                else {
                    r.contentContainer.outerHeight() - 1 > qa && r.contentContainer.outerHeight(qa);
                    qa = r.innerContainer.height() /
                        2;
                    var Ca = r.innerContainer.width() / 2;
                    r.innerContainer.css({
                        left: "50%",
                        "margin-left": -1 * Ca,
                        "margin-top": -1 * qa,
                        top: "50%"
                    })
                }
            } else {
                var Ea = 0;
                r.innerContainer.children().not(r.contentContainer).each(function() {
                    if (!p.hideFooterInMobileView || !$(this).is(r.footerContainer)) Ea += $(this).outerHeight()
                });
                r.contentContainer.outerHeight(r.innerContainer.height() - Ea)
            }
        }
    }

    function e() {
        r.contentContainer.html(p.loadingText);
        r.contentContainer.load(p.ajaxUrl, a)
    }

    function g() {
        r.contentContainer.empty().append($("<iframe/>").attr("src",
            p.iframeUrl).addClass(CssModal.commonSettings.cssClasses.iframe).attr("seamless", "seamless").attr("frameborder", "0").on("load", function() {
            a()
        }))
    }

    function k(qa) {
        if (p.expandToAllWindowSize) {
            CommonFunctions.makePostMessageCall(window.top, {
                messageName: qa
            });
            IframeResizer.reportSetIframeDefaultHeight()
        }
    }
    window[j] = this;
    var l = this,
        o = j,
        n, m = false,
        p, r, B, ca, z, S, ha, wa = $(window),
        La = $("html"),
        ma = $("body"),
        Ga;
    l.initialize = function(qa, Ca, Ea) {
        B = Ca;
        p = Ea;
        r = $.extend(qa, {
            closeButton: $("." + p.closeButtonClass)
        });
        n = p.mode;
        $(document).keyup(function(Sa) {
            l.keyUp(Sa)
        });
        CssModal.modes.ajaxStatically === n && e();
        CssModal.modes.iframeStatically === n && g();
        wa.on("hashchange", c);
        wa.on("resize", d);
        wa.on("load", c);
        r.closeButton.click(f);
        CssModal.instances.push(this)
    };
    l.openDialog = function(qa) {
        l._maximized = qa;
        window.location.hash = "#" + o;
        qa ? r.innerContainer.addClass("ccl-cssmodal-modal-maximized") : r.innerContainer.removeClass("ccl-cssmodal-modal-maximized")
    };
    l.keyUp = function(qa) {
        h() && qa.which === CommonConstants.keyCodes.escape && f() &&
            CssModal.closeDialog()
    };
    l.setContentMinSize = function(qa, Ca) {
        p.minContentWidth = qa;
        p.minContentHeight = Ca;
        a()
    };
    l.setTitle = function(qa) {
        if (qa) {
            var Ca = $("h2", r.headerContainer);
            Ca && Ca.text(qa)
        }
    };
    l.setAjaxUrl = function(qa) {
        p.ajaxUrl = qa
    };
    l.setIframeUrl = function(qa, Ca) {
        p.iframeUrl = qa;
        Ca && g()
    };
    l.setCloseConfirmation = function(qa) {
        ca = qa
    };
    l.toggleDialogCloseButton = function(qa) {
        r.closeButton.toggleHyperlink(qa)
    };
    l.getFooter = function() {
        return r.footerContainer
    };
    l.adjustWindowSize = function() {
        a()
    };
    l.getIsOpened = function() {
        return m
    };
    return l
}
CssModal.commonSettings = undefined;
CssModal.modes = undefined;
CssModal.closeDialog = function() {
    window.location.hash = "!"
};
CssModal.instances = [];

function DatePicker(j) {
        function f() {
            return !a.controls.dateInput.val() || a.controls.dateInput.val() === e.waterMark
        }

        function h() {
            a.controls.dateInput.val(e.waterMark).removeClass(g.watermark).addClass(g.watermark)
        }

        function b() {
            if (!m && p) m = window[a.settings.timeSlotPickerClientInstanceName];
            return m
        }

        function c(z, S) {
            if ((k || r) && a.getAvailableDatesFunction) {
                var ha = S == 12 ? new Date(z, 12, 6) : new Date(z, S, 6);
                ha = {
                    startDate: JSON.stringify(S == 1 ? new Date(z, -1, 25) : new Date(z, S - 2, 25)),
                    endDate: JSON.stringify(ha),
                    filterId: B
                };
                a.getAvailableDatesFunction(ha);
                l = ha.allowedDates
            }
        }

        function d(z, S) {
            if (o && a.getCssClassesForCalendarDatesFunction) {
                var ha = S == 12 ? new Date(z, 12, 6) : new Date(z, S, 6);
                ha = {
                    startDate: JSON.stringify(S == 1 ? new Date(z, -1, 25) : new Date(z, S - 2, 25)),
                    endDate: JSON.stringify(ha)
                };
                a.getCssClassesForCalendarDatesFunction(ha);
                n = ha.customCssClassesForCalendarDates
            }
        }
        window[j] = this;
        var a = this,
            e, g, k, l, o, n, m, p, r, B, ca;
        a.initialize = function() {
            e = a.settings;
            g = e.cssClasses;
            o = e.useCustomCssClassesForCalendarDates;
            k = e.useRestrictedDateSelection;
            p = !!a.settings.timeSlotPickerClientInstanceName;
            DatePickerPool.add(a.controls.dateInput, a);
            a.controls.dateInput.datepicker({
                showOn: e.hideInput ? "button" : "both",
                buttonImage: "",
                buttonImageOnly: false,
                showButtonPanel: true,
                showOtherMonths: true,
                selectOtherMonths: true,
                defaultDate: null,
                dateFormat: e.dateFormat,
                firstDay: e.firstDayOfWeek,
                waterMark: e.waterMark,
                monthNames: e.monthNames,
                monthNamesShort: e.abbreviatedMonthNames,
                dayNames: e.dayNames,
                dayNamesShort: e.abbreviatedDayNames,
                dayNamesMin: e.abbreviatedDayNames,
                closeText: e.closeText,
                prevText: e.previousMonthText,
                nextText: e.nextMonthText,
                currentText: e.todayText,
                disabled: e.disabled,
                showWeek: e.showWeek,
                weekHeader: e.weekHeader,
                beforeShow: function(z, S) {
                    z = $(z);
                    z.val() == $.datepicker._get(S, "waterMark") && z.val("").removeClass(g.watermark);
                    var ha = z.datepicker("getDate");
                    if (ha == null) ha = new Date;
                    if (k || r) c(ha.getFullYear(), ha.getMonth() + 1);
                    o && d(ha.getFullYear(), ha.getMonth() + 1);
                    ca = z.val();
                    setTimeout(function() {
                        z.trigger("update")
                    }, 1)
                },
                onChangeMonthYear: function(z, S,
                    ha) {
                    c(z, S);
                    d(z, S);
                    setTimeout(function() {
                        $(ha.input).trigger("update")
                    }, 1)
                },
                beforeShowDay: function(z) {
                    if (!k && !r && !o) return [true];
                    if (l == undefined && n == undefined) return [true];
                    z = [z.getFullYear(), z.getMonth() + 1, z.getDate()].join("_");
                    var S = [true];
                    if ((k || r) && l != undefined) S = l[z] == undefined ? [false, g.disabled] : l[z] == 1 ? [true, g.avalaible] : [false, g.busy];
                    o && n != undefined && n[z] != undefined && $.each(n[z], function(ha, wa) {
                        S[1] = ha;
                        S[2] = wa
                    });
                    return S
                },
                onClose: function(z, S) {
                    var ha = $(this);
                    if (!ha.val()) {
                        ha.val($.datepicker._get(S,
                            "waterMark")).addClass(g.watermark);
                        p && b().resetTimes()
                    }
                    if (a.relatedWithDateInput && a.relatedWithDateInput.isLater) {
                        ha = window[a.relatedWithDateInput.id].getDateAsString();
                        if (z && (ha == "" || ha == ca)) window[a.relatedWithDateInput.id].setDate(z)
                    }
                    ca = z
                }
            }).on("update", function() {
                a.settings.showWeek && $("td.ui-datepicker-week-col").wrapInner('<a href="javascript:void(0);"></a>').on("click", function() {
                    var z, S;
                    if (a.relatedWithDateInput) {
                        if (a.relatedWithDateInput.isLater) {
                            $(this).next().click();
                            S = z = a.controls.dateInput.datepicker("getDate");
                            S.setDate(z.getDate() + 6)
                        } else {
                            z = $(this).parent().find("td");
                            z.get(z.length - 1).click();
                            S = z = a.controls.dateInput.datepicker("getDate");
                            S.setDate(z.getDate() - 6)
                        }
                        window[a.relatedWithDateInput.id].setDate(S)
                    } else $(this).next().click()
                });
                e.hideTodayButton && $(".ui-datepicker-current").hide()
            }).trigger("update");
            $("#ui-datepicker-div").hide();
            e.hideInput && a.controls.dateInput.hide();
            f() && h();
            a.controls.dateInput.change(function() {
                if (a.onDateSelectedFunction) {
                    var z = {
                        dateText: a.getDateAsString(),
                        dateFilterId: r ?
                            B : 0
                    };
                    a.onDateSelectedFunction(z)
                }
            }).keypress(function(z) {
                if (z.which === CommonConstants.keyCodes.enter) {
                    a.controls.dateInput.change();
                    z.preventDefault()
                }
            });
            k && a.controls.dateInput.keypress(function(z) {
                z.which !== CommonConstants.keyCodes.del && z.which !== CommonConstants.keyCodes.backspace && z.preventDefault()
            })
        };
        a.getDateAsString = function() {
            if (f()) return "";
            var z = a.controls.dateInput.val();
            try {
                $.datepicker.parseDate(e.dateFormat, z)
            } catch (S) {
                return ""
            }
            return z
        };
        a.getDate = function() {
            return f() ? undefined : a.controls.dateInput.datepicker("getDate")
        };
        a.setDate = function(z) {
            if (z) {
                a.controls.dateInput.removeClass(g.watermark);
                a.controls.dateInput.datepicker("setDate", z)
            } else h()
        };
        a.clearDateAndTime = function(z) {
            !f() && !z && a.setDate("");
            p && b().resetTimes()
        };
        a.setFilteringMode = function(z) {
            r = z
        };
        a.setFilterId = function(z) {
            B = z
        };
        return a
    }
    (function(j, f) {
        function h(c, d) {
            d = d ? d : 0;
            if (d < c.length)
                for (var a = b.length - 1; a >= 0; a--)
                    if (b[a].jQueryInput.get(0) === c.get(d)) return b[a].datePickerFunction;
            return f
        }
        var b = [];
        j.DatePickerPool = {
            add: function(c, d) {
                b.push({
                    jQueryInput: c,
                    datePickerFunction: d
                })
            },
            getDateAsString: function(c) {
                return (c = h(c)) ? c.getDateAsString() : ""
            },
            getDate: function(c) {
                return h(c) ? h(c).getDate() : f
            },
            setDate: function(c, d) {
                for (var a = c.length - 1; a >= 0; a--) {
                    var e = h(c, a);
                    e && e.setDate(d)
                }
            }
        }
    })(window);

function DateTimeActivation(j) {
    function f() {
        d || (d = window[h.settings.datePickerClientInstanceName]);
        return d
    }
    window[j] = this;
    var h = this,
        b, c, d, a, e, g, k;
    h.initialize = function() {
        b = h.settings;
        c = b.cssClasses;
        a = b.dateFilteringInUse;
        e = h.controls.selectActivationMode.parent();
        k = b.modes;
        g = !!b.timeSlotPickerClientInstanceName;
        h.controls.selectActivationMode.change(function() {
            var l = h.controls.selectActivationMode.val();
            h.controls.dateTimeControlsContainer.toggle(l != k.empty && l != k.infinity);
            $("." + c.timeControlsContainer,
                e).toggleClass(c.hiddenTimeControlsContainer, l != k.date);
            h.controls.endOfDayLabel.toggle(l == k.endOfDay);
            var o = a && l == k.filtering;
            h.controls.datePickerFilterHolder.toggle(o);
            f().setFilteringMode(o);
            a && f().clearDateAndTime(l != k.filtering);
            g && window[b.timeSlotPickerClientInstanceName].toggle(l == k.filtering);
            h.onChangeActivationModeFunction && h.onChangeActivationModeFunction()
        });
        if (a) {
            h.controls.filterDropDown.change(function() {
                var l = h.controls.filterDropDown.val();
                h.controls.filterHidden.val(l);
                f().clearDateAndTime();
                f().setFilterId(l)
            });
            if (f()) {
                f().setFilterId(h.controls.filterHidden.val());
                f().setFilteringMode(a && h.controls.selectActivationMode.val() == k.filtering)
            }
        }
    };
    h.getMode = function() {
        return h.controls.selectActivationMode.val()
    };
    return h
}

function Dialog(j) {
    function f() {
        if (B) {
            k.show();
            b();
            CommonFunctions.safeExecuteFunction(a.customScripts.afterOpenDialog);
            IframeResizer.reportSetIframeDefaultHeight();
            B = false
        }
    }

    function h() {
        g.scrollLeft(S);
        g.scrollTop(z);
        IframeResizer.reportSetIframeDefaultHeight();
        ca = false
    }

    function b() {
        var ma = function(qa, Ca, Ea, Sa) {
                Ea = Math.max((qa - Ea) / 2, 10);
                if (qa < Sa) Ea += Ca;
                return Ea < 0 ? 0 : Ea
            },
            Ga = $(document);
        k.offset({
            left: ma(g.width(), g.scrollLeft(), k.width(), Ga.width()),
            top: ma(g.height(), g.scrollTop(), k.height(), Ga.height())
        })
    }

    function c() {
        if (a.settings.useInProgressFunctionality) {
            g.unload(function() {
                a.close()
            });
            o.attr("title", a.settings.okButtonInProgressTitle);
            o.addClass(a.settings.inProgressCssClass);
            a.disableDialog();
            setTimeout(function() {
                CommonFunctions.safeExecuteFunction(a.customScripts.afterOkClick);
                k.find("input,button").prop("disabled", true)
            }, 100)
        } else CommonFunctions.safeExecuteFunction(a.customScripts.afterOkClick) && a.close()
    }

    function d() {
        CommonFunctions.safeExecuteFunction(a.customScripts.afterCancelClick) &&
            a.close()
    }
    window[j] = this;
    var a = this,
        e = $("#mask"),
        g = $(window),
        k, l, o, n, m, p, r, B = false,
        ca = false,
        z, S, ha = CommonWindowMessages.contentAreaFrameHasExpanded.messageName,
        wa = CommonWindowMessages.contentAreaFrameHasCollapsed.messageName,
        La = false;
    a.initialize = function() {
        k = a.controls.container;
        l = a.controls.iframe;
        o = a.controls.okButton;
        n = a.settings.showBackgroundMask;
        m = a.settings.useTransparentMask;
        p = a.settings.expandToAllWindowSize;
        r = a.settings.ignoreKeyDown;
        La = !p || window == window.top;
        k.css("z-index", a.settings.zIndex).keydown(function(ma) {
            return a.keyDown(ma)
        }).keypress(function(ma) {
            return a.keyPress(ma)
        });
        a.controls.closeLink.click(function() {
            d();
            return false
        }).keydown(function(ma) {
            if (ma.which === CommonConstants.keyCodes.enter) {
                d();
                return false
            }
            return true
        });
        o.click(function() {
            c();
            return false
        });
        a.controls.cancelLink.click(function() {
            d();
            return false
        });
        p && CommonFunctions.attachPostMessageEventListener(g, [ha, wa], function(ma) {
            if (ma.messageName === ha && B) f();
            else ma.messageName === wa && ca && h()
        });
        a.settings.openDialogAfterLoading && a.open()
    };
    a.openWithTitle = function(ma) {
        a.setNewTitle(ma);
        a.open()
    };
    a.open = function() {
        B =
            true;
        S = g.scrollLeft();
        z = g.scrollTop();
        if (n) {
            if (e.length == 0) e = $("<div id='mask'></div>").appendTo("body").addClass(a.settings.maskCssClass);
            e.css({
                opacity: m ? "0" : "0.5",
                filter: "alpha(opacity=" + (m ? "0" : "50") + ")",
                "z-index": a.settings.backgroundMaskZIndex
            });
            e.show()
        }
        CommonFunctions.safeExecuteFunction(a.customScripts.beforeOpenDialog);
        if (La) f();
        else p && a.toggleContentAreaFrame(true);
        setTimeout(f, 100)
    };
    a.close = function() {
        ca = true;
        CommonFunctions.safeExecuteFunction(a.customScripts.beforeCloseDialog);
        n && e.hide();
        k.hide();
        CommonFunctions.safeExecuteFunction(a.customScripts.afterCloseDialog);
        if (La) h();
        else p && a.toggleContentAreaFrame(false)
    };
    a.setupIframe = function(ma, Ga, qa, Ca) {
        l.attr("width", Ga ? Ga : l.attr("width")).attr("height", qa ? qa : l.attr("height")).attr("scrolling", Ca ? Ca : l.attr("scrolling"));
        a.setIframeSrc(ma)
    };
    a.setIframeSrc = function(ma) {
        a.settings.frameLoadingText && l.contents().find("body").empty().text(a.settings.frameLoadingText);
        document.getElementById(l.prop("id")).contentWindow.location.href = ma
    };
    a.setNewAfterOkClickFunction = function(ma) {
        a.customScripts.afterOkClick = ma
    };
    a.setNewAfterCancelClickFunction = function(ma) {
        a.customScripts.afterCancelClick = ma
    };
    a.setNewBeforeCloseDialogFunction = function(ma) {
        a.customScripts.beforeCloseDialog = ma
    };
    a.setNewTitle = function(ma) {
        a.controls.titleContainer.text(ma)
    };
    a.enableOrDisableOkButton = function(ma) {
        o.prop("disabled", !ma)
    };
    a.disableDialog = function() {
        a.enableOrDisableOkButton(false);
        a.controls.cancelLink.unbind("click").attr("disabled", true);
        a.controls.closeLink.unbind("click").attr("disabled",
            true);
        a.controls.closeLink.find("img").prop("src", a.settings.closeImageDisabledUrl)
    };
    a.getContainerJQueryElement = function() {
        return k
    };
    a.focusOnCloseLink = function() {
        a.controls.closeLink.focus()
    };
    a.keyDown = function(ma) {
        if (ma.target && ma.target.className && ma.target.className.indexOf("cke_source") >= 0 || r) return true;
        if (ma.which === CommonConstants.keyCodes.escape) d();
        else if (ma.which === CommonConstants.keyCodes.enter && !ma.shiftKey && (!ma.srcElement || ma.srcElement.tagName !== "A")) c();
        return true
    };
    a.keyPress =
        function() {
            return true
        };
    a.scrollWindowToCenter = function() {
        var ma = k.offset().top,
            Ga = g.height(),
            qa = k.height();
        window.scrollTo(0, ma - (Ga / 2 - qa / 2))
    };
    a.toggleContentAreaFrame = function(ma) {
        CommonFunctions.makePostMessageCall(window.top, ma ? CommonWindowMessages.expandContentAreaFrame : CommonWindowMessages.collapseContentAreaFrame);
        IframeResizer.reportSetIframeDefaultHeight()
    };
    return a
}

function DivToggler(j) {
    var f = this;
    f.settings = j;
    f.div = f.settings.divControl ? $(f.settings.divControl) : $("#" + f.settings.divId);
    if (f.settings.changeDivVisibility == undefined) f.settings.changeDivVisibility = true;
    f.initialize = function() {
        f.settings.isCollapsed ? f.collapseDiv() : f.expandDiv();
        return f
    };
    f.afterToggle = function() {
        f.settings.afterToggle && typeof f.settings.afterToggle === "function" && f.settings.afterToggle()
    };
    f.toggleDiv = function(h) {
        f.settings.isCollapsed ? f.expandDiv() : f.collapseDiv();
        h && typeof h ===
            "function" && h()
    };
    f.collapseDiv = function() {
        f.settings.changeDivVisibility && f.div.hide();
        f.settings.isCollapsed = true;
        f.afterToggle()
    };
    f.expandDiv = function() {
        f.settings.changeDivVisibility && f.div.show();
        f.settings.isCollapsed = false;
        f.afterToggle()
    };
    return f
}

function DropDownMenu(j, f) {
    function h(n, m) {
        l && clearTimeout(l);
        l = setTimeout(function() {
            var p = m.relatedTarget || document.activeElement,
                r = $(p),
                B = p === e[0] || r.closest(e).length === 1;
            p = p === g[0] || r.closest(g).length === 1;
            !B && !p && c()
        }, n)
    }

    function b() {
        o.scroll(d);
        g.addClass(a.settings.selectedHolderCssClass);
        var n = a.settings.useTargetPosition ? k.position() : k.offset();
        a.settings.setMinWidthByTarget && e.css("min-width", k.outerWidth() + "px");
        var m = n.top + k.outerHeight(false),
            p = "auto",
            r = "auto";
        switch (a.settings.horizontalPosition) {
            case DropDownMenuCommonSettings.horizontalPositions.rightEdge:
                p =
                    n.left + k.outerWidth(false) - e.outerWidth(false);
                if (p < 0) p = n.left;
                break;
            case DropDownMenuCommonSettings.horizontalPositions.rightEdgeRightOffset:
                r = o.width() - o.scrollLeft() - n.left - k.outerWidth(false);
                if (r < 0) r = 0;
                break;
            default:
                p = n.left
        }
        n = {
            top: m,
            left: p,
            right: r,
            "z-index": a.settings.zIndex
        };
        if (a.settings.autofitHeight) {
            n["max-height"] = o.height() - m;
            n["overflow-y"] = "scroll"
        }
        e.css(n).show()
    }

    function c() {
        o.unbind("scroll", d);
        e.hide();
        g.removeClass(a.settings.selectedHolderCssClass)
    }

    function d() {
        var n = a.settings.useTargetPosition ?
            k.position() : k.offset();
        e.css({
            top: n.top + k.outerHeight(false)
        })
    }
    window[j] = this;
    var a = this,
        e, g, k, l, o = $(window);
    f && DropDownMenu.instances.push(this);
    a.initialize = function() {
        if (!e) {
            e = $("#" + a.controls.menuContainerId);
            g = $("#" + a.controls.targetLinkId);
            k = $("#" + a.controls.layoutAlignmentControlId);
            if (!a.settings.showMenuOnHover || a.settings.isIos) $(document).on((a.settings.isIos ? "touchend" : "click") + " " + CommonTriggers.clickInInnerFrame, function(n) {
                if (n.target === g[0] || $(n.target).closest(g).length === 1) e.is(":visible") ?
                    c() : b();
                else if (e.is(":visible")) n.target === e[0] || $(n.target).closest(e).length === 1 || c()
            });
            else {
                g.on("focusin mouseover", function() {
                    b()
                });
                e.add(g).on("focusout mouseout", function(n) {
                    h(250, n)
                })
            }
            a.settings.closeMenuWhenClickingOnLink && e.find("li").click(function() {
                c()
            });
            a.settings.closeMenuWhenClickingInside && e.click(function() {
                c()
            });
            $(document).ready(function() {
                a.settings.appendToBody && e.appendTo("body")
            })
        }
    };
    return a
}
DropDownMenu.instances = [];
DropDownMenu.initialize = function() {
    for (var j = 0, f = this.instances.length; j < f; j += 1) this.instances[j].initialize()
};
ExpandableContainer.defaults = {
    isExpanded: false,
    expander: ".ccl-expandable-container-header",
    target: ".ccl-expandable-container-content",
    keepStateInCookie: false,
    cookieName: "ExpandableContainerState",
    accessibleExpander: "a",
    expandTooltip: undefined,
    collapseTooltip: undefined
};

function ExpandableContainer(j, f) {
    function h(n) {
        if (a.settings.collapseTooltip && a.settings.expandTooltip) o.attr("title", n ? a.settings.collapseTooltip : a.settings.expandTooltip)
    }

    function b() {
        var n = d();
        n ? e.addClass("expanded") : l.hide();
        h(n)
    }

    function c() {
        var n = $.cookie(a.settings.cookieName);
        return n === null || n === "" ? {} : JSON.parse(n)
    }

    function d() {
        if (a.settings.isExpanded) return true;
        if (!a.settings.keepStateInCookie) return false;
        var n = e.attr("Id");
        if (n === undefined) return false;
        return c()[n] === true || false
    }
    var a = this,
        e = $(j);
    a.settings = {};
    $.extend(a.settings, ExpandableContainer.defaults);
    $.extend(a.settings, f);
    var g = $(a.settings.expander, j),
        k = g.attr("data-expander-target") || a.settings.target,
        l = $(k, j),
        o = $(a.settings.accessibleExpander, g);
    a.toggle = function() {
        var n = !a.getIsExpandedState();
        if (n) {
            e.addClass("expanded");
            l.slideDown()
        } else {
            e.removeClass("expanded");
            l.slideUp()
        }
        $(document).trigger("expandablecontainer:toggled", [j, n]);
        h(n);
        if (a.settings.keepStateInCookie) {
            var m = e.attr("Id");
            if (m !== undefined) {
                var p =
                    c();
                p[m] = n;
                $.cookie(a.settings.cookieName, JSON.stringify(p), {
                    path: "/"
                })
            }
        }
        return false
    };
    a.getIsExpandedState = function() {
        return e.hasClass("expanded")
    };
    (function() {
        if (a.settings.keepStateInCookie && $.cookie === undefined) throw Error("keepStateInCookie option requires $.cookie to be defined.");
        g.addClass("ccl-expandable-container-expander");
        if (l.length === 0 || g.length === 0)
            if (a.settings.throwOnMissingTarget) throw "Targets not found";
        b();
        g.click(function() {
            a.toggle()
        })
    })();
    return a
}
$.widget("itslccl.extendedTextBox", {
    options: {
        watermarkText: "",
        watermarkCssClass: ""
    },
    _input: undefined,
    _isWatermarkMode: false,
    _create: function() {
        var j = this;
        this._input = this.element;
        this._input.is(":focus") ? this._input.setCursorPosition(this._input.val().length) : this._showWatermark();
        this._input.keypress(function(f) {
            f = f ? f : window.event;
            j._hideWatermark();
            return f.which !== CommonConstants.keyCodes.enter || f.shiftKey
        });
        this._input.blur(function() {
            j._input.is(":visible") && j._showWatermark()
        });
        this._input.focus(function() {
            j._hideWatermark()
        });
        this._input.on("paste", function() {
            j._hideWatermark()
        })
    },
    _showWatermark: function() {
        if (!(this._isWatermarkMode || this._input.val())) {
            this._input.val(this.options.watermarkText);
            this._input.addClass(this.options.watermarkCssClass);
            this._isWatermarkMode = true
        }
    },
    _hideWatermark: function() {
        if (this._isWatermarkMode) {
            this._input.val("");
            this._input.removeClass(this.options.watermarkCssClass);
            this._isWatermarkMode = false
        }
    }
});

function Feedback(j) {
    window[j] = this;
    var f = this;
    f.showMessage = function(h, b) {
        var c = f.controls;
        c.container.removeClass(f.settings.cssClasses.join(" ")).addClass(f.settings.feedbackCssClass).addClass(f.settings.cssClasses[h]).show();
        b ? c.textSpan.html(b).show() : c.textSpan.hide();
        f.hideUndo()
    };
    f.hide = function(h) {
        f.controls.container.hide();
        if ((h == undefined || h) && f.functions.onClose) f.functions.onClose()
    };
    f.hideUndo = function() {
        f.controls.undoLink.hide()
    };
    f.show = function() {
        f.controls.container.show()
    };
    f.toggleCloseLink =
        function(h) {
            f.controls.closeLink.toggle(h)
        };
    return f
}

function FileList(j) {
        window[j] = this;
        var f = this;
        f.initialize = function() {};
        f.showPreview = function(h, b, c, d) {
            $(f.controls.title).html(f.settings.titleText + " " + h);
            window[f.controls.dialog.replace("#", "")].setContentMinSize(c, d);
            window[f.controls.dialog.replace("#", "")].setAjaxUrl(f.settings.serviceMethodUrl + "?fileId=" + b)
        };
        return f
    }
    (function(j) {
        typeof define === "function" && define.amd ? define(["jquery", "tmpl", "load-image", "./jquery.fileupload-fp"], j) : j(window.jQuery, window.tmpl, window.loadImage)
    })(function(j, f, h) {
        j.widget("blueimp.fileupload", j.blueimp.fileupload, {
            options: {
                autoUpload: true,
                maxNumberOfFiles: undefined,
                maxFileSize: undefined,
                minFileSize: undefined,
                acceptFileTypes: /.+$/i,
                previewSourceFileTypes: /^image\/(gif|jpeg|png)$/,
                previewSourceMaxFileSize: 5E6,
                previewMaxWidth: 80,
                previewMaxHeight: 80,
                previewAsCanvas: true,
                filesContainer: undefined,
                prependFiles: false,
                dataType: "json",
                kbText: "KB",
                mbText: "MB",
                confirmReplaceFile: function() {
                    return true
                },
                customErrors: undefined,
                drop: function(b, c) {
                    var d = (j(this).data("blueimp-fileupload") || j(this).data("fileupload")).options,
                        a = [],
                        e = false;
                    j.each(c.files, function(g, k) {
                        if (!k.type && (k.size === undefined || k.size < 1 || k.size % 4096 == 0 && k.name.split(".").length < 2)) e = true;
                        else a.push(k)
                    });
                    if (e) c.files = a;
                    if (d.singleFileMode && c.files.length > 1) c.files = c.files.slice(0, 1)
                },
                add: function(b, c) {
                    var d = j(this).data("blueimp-fileupload") ||
                        j(this).data("fileupload"),
                        a = d.options,
                        e = c.files;
                    j(this).fileupload("process", c).done(function() {
                        if (a.singleFileMode && a.maxNumberOfFiles == 0)
                            if (a.confirmReplaceFile()) d.emptyFileList();
                            else return false;
                        d._adjustMaxNumberOfFiles(-e.length);
                        c.maxNumberOfFilesAdjusted = true;
                        c.files.valid = c.isValidated = d._validate(e);
                        if (c.files.length > 0 && d.options.defaultThumbnailUrl) c.files[0].thumbnailUrl = d.options.defaultThumbnailUrl;
                        c.context = d._renderUpload(e).data("data", c);
                        a.filesContainer[a.prependFiles ? "prepend" :
                            "append"](c.context);
                        d._renderPreviews(c);
                        d._forceReflow(c.context);
                        d._transition(c.context).done(function() {
                            if (d._trigger("added", b, c) !== false && (a.autoUpload || c.autoUpload) && c.autoUpload !== false && c.isValidated) c.submit()
                        })
                    })
                },
                send: function(b, c) {
                    var d = j(this).data("blueimp-fileupload") || j(this).data("fileupload");
                    if (d._additionalClientValidationCallback && !d._additionalClientValidationCallback(c)) return false;
                    if (!c.isValidated) {
                        if (!c.maxNumberOfFilesAdjusted) {
                            d._adjustMaxNumberOfFiles(-c.files.length);
                            c.maxNumberOfFilesAdjusted = true
                        }
                        if (!d._validate(c.files)) return false
                    }
                    if (c.context && c.dataType && c.dataType.substr(0, 6) === "iframe") {
                        c.context.find(".ccl-progressbar").addClass(!j.support.transition && "progress-animated").find(".ui-progressbar-value").css("width", "100%");
                        c.context.find(".ccl-progressbar-labelcontainer").html("100%")
                    }
                    d._addUploadToList(b, c);
                    return d._trigger("sent", b, c)
                },
                done: function(b, c) {
                    var d = j(this).data("blueimp-fileupload") || j(this).data("fileupload"),
                        a = d._getFilesFromResponse(c),
                        e, g;
                    if (c.context) c.context.each(function(k) {
                        var l = a[k] || {
                                error: "Empty file upload result"
                            },
                            o = d._addFinishedDeferreds();
                        l.error || d._addFilesToList(a);
                        d._transition(j(this)).done(function() {
                            var n = j(this);
                            e = d._renderDownload([l]).replaceAll(n);
                            d._forceReflow(e);
                            d._transition(e).done(function() {
                                c.context = j(this);
                                d._renderPreviews(c);
                                d._trigger("completed", b, c);
                                d._trigger("finished", b, c);
                                o.resolve()
                            })
                        })
                    });
                    else {
                        if (a.length) {
                            j.each(a, function(k, l) {
                                if (c.maxNumberOfFilesAdjusted && l.error) d._adjustMaxNumberOfFiles(1);
                                else !c.maxNumberOfFilesAdjusted && !l.error && d._adjustMaxNumberOfFiles(-1)
                            });
                            c.maxNumberOfFilesAdjusted = true
                        }
                        e = d._renderDownload(a).appendTo(d.options.filesContainer);
                        d._renderPreviews(c);
                        d._forceReflow(e);
                        g = d._addFinishedDeferreds();
                        d._transition(e).done(function() {
                            c.context = j(this);
                            d._trigger("completed", b, c);
                            d._trigger("finished", b, c);
                            g.resolve()
                        })
                    }
                },
                fail: function(b, c) {
                    var d = j(this).data("blueimp-fileupload") || j(this).data("fileupload"),
                        a, e;
                    c.maxNumberOfFilesAdjusted && d._adjustMaxNumberOfFiles(c.files.length);
                    if (c.context) c.context.each(function(g) {
                        if (c.errorThrown !== "abort") {
                            var k = c.files[g];
                            g = c.jqXHR && c.jqXHR.responseText ? j.parseJSON(c.jqXHR.responseText).message : undefined;
                            k.error = k.error || g || c.errorThrown || d.options.customErrors.unknownError;
                            e = d._addFinishedDeferreds();
                            d._transition(j(this)).done(function() {
                                var l = j(this);
                                a = d._renderDownload([k]).replaceAll(l);
                                d._forceReflow(a);
                                d._transition(a).done(function() {
                                    c.context = j(this);
                                    d._trigger("failed", b, c);
                                    d._trigger("finished", b, c);
                                    e.resolve()
                                })
                            })
                        } else {
                            e =
                                d._addFinishedDeferreds();
                            d._transition(j(this)).done(function() {
                                j(this).remove();
                                d._trigger("failed", b, c);
                                d._trigger("finished", b, c);
                                e.resolve()
                            })
                        }
                    });
                    else if (c.errorThrown !== "abort") {
                        c.context = d._renderUpload(c.files).appendTo(d.options.filesContainer).data("data", c);
                        d._forceReflow(c.context);
                        e = d._addFinishedDeferreds();
                        d._transition(c.context).done(function() {
                            c.context = j(this);
                            d._trigger("failed", b, c);
                            d._trigger("finished", b, c);
                            e.resolve()
                        })
                    } else {
                        d._trigger("failed", b, c);
                        d._trigger("finished", b,
                            c);
                        d._addFinishedDeferreds().resolve()
                    }
                },
                progress: function(b, c) {
                    if (c.context) {
                        var d = parseInt(c.loaded / c.total * 100, 10);
                        c.context.find(".ccl-progressbar .ui-progressbar-value").css("width", d + "%");
                        c.context.find(".ccl-progressbar-labelcontainer").html(d + "%")
                    }
                },
                progressall: function(b, c) {
                    var d = j(this),
                        a = parseInt(c.loaded / c.total * 100, 10),
                        e = d.find(".fileupload-progress"),
                        g = e.find(".progress-extended");
                    if (g.length) g.html((d.data("blueimp-fileupload") || d.data("fileupload"))._renderExtendedProgress(c));
                    e.find(".ccl-progressbar .ui-progressbar-value").css("width",
                        a + "%");
                    e.find(".ccl-progressbar-labelcontainer").html(a + "%")
                },
                start: function(b) {
                    var c = j(this).data("blueimp-fileupload") || j(this).data("fileupload");
                    c._resetFinishedDeferreds();
                    c._transition(j(this).find(".fileupload-progress")).done(function() {
                        c._trigger("started", b)
                    });
                    c._startUploadCallback && c._startUploadCallback()
                },
                stop: function(b) {
                    var c = j(this).data("blueimp-fileupload") || j(this).data("fileupload"),
                        d = c._addFinishedDeferreds();
                    j.when.apply(j, c._getFinishedDeferreds()).done(function() {
                        c._trigger("stopped",
                            b)
                    });
                    c._transition(j(this).find(".fileupload-progress")).done(function() {
                        var a = j(this);
                        a.find(".ccl-progressbar .ui-progressbar-value").css("width", "0");
                        a.find(".ccl-progressbar-labelcontainer").html("0%");
                        a.find(".progress-extended").html("&nbsp;");
                        d.resolve()
                    });
                    c._stopUploadCallback && c._stopUploadCallback()
                },
                destroy: function(b, c) {
                    var d = j(this).data("blueimp-fileupload") || j(this).data("fileupload");
                    c.url && j.ajax(c);
                    c.filekey && d._adjustMaxNumberOfFiles(1);
                    d._removeFilesFromList(c.filekey);
                    d._transition(c.context).done(function() {
                        j(this).remove();
                        d._trigger("destroyed", b, c)
                    })
                }
            },
            _addFilesToList: function(b) {
                var c = this;
                if (!c._fileList) {
                    c._fileList = [];
                    c._fileListKeys = []
                }
                j.each(b, function(d, a) {
                    c._fileList.push(a);
                    c._fileListKeys.push(a.id)
                });
                c.options.stateHiddenField.val(JSON.stringify(c._fileList));
                c._notifyAboutResultChanges();
                c._addFileCallback && c._addFileCallback()
            },
            _addUploadToList: function(b, c) {
                if (!this._uploadsList) this._uploadsList = [];
                this._uploadsList.push({
                    element: b,
                    data: c
                })
            },
            _removeFilesFromList: function(b) {
                if (this._fileList && this._fileList.length >
                    0) {
                    b = this._fileListKeys.indexOf(b);
                    if (b > -1) {
                        this._fileList = this._fileList.remove(this._fileList[b]);
                        this._fileListKeys = this._fileListKeys.remove(this._fileListKeys[b])
                    }
                }
                this.options.stateHiddenField.val(JSON.stringify(this._fileList));
                this._notifyAboutResultChanges();
                this._removeFileCallback && this._removeFileCallback()
            },
            _notifyAboutResultChanges: function() {
                this._trigger("resultschanged", null, {
                    results: this._fileList
                })
            },
            _resetFinishedDeferreds: function() {
                this._finishedUploads = []
            },
            _addFinishedDeferreds: function(b) {
                b ||
                    (b = j.Deferred());
                this._finishedUploads.push(b);
                return b
            },
            _getFinishedDeferreds: function() {
                return this._finishedUploads
            },
            _getFilesFromResponse: function(b) {
                if (b.result && j.isArray(b.result.files)) return b.result.files;
                return []
            },
            _enableDragToDesktop: function() {
                var b = j(this),
                    c = b.prop("href"),
                    d = b.prop("download");
                b.bind("dragstart", function(a) {
                    try {
                        a.originalEvent.dataTransfer.setData("DownloadURL", ["application/octet-stream", d, c].join(":"))
                    } catch (e) {}
                })
            },
            _adjustMaxNumberOfFiles: function(b) {
                if (typeof this.options.maxNumberOfFiles ===
                    "number") {
                    this.options.maxNumberOfFiles += b;
                    this.options.maxNumberOfFiles < 1 && !this.options.singleFileMode ? this._disableFileInputButton() : this._enableFileInputButton()
                }
            },
            _formatFileSize: function(b) {
                if (typeof b !== "number") return "";
                if (b >= 1048576) return (b / 1048576).toFixed(2) + " " + this.options.mbText;
                return (b / 1024).toFixed(2) + " " + this.options.kbText
            },
            _formatBitrate: function(b) {
                if (typeof b !== "number") return "";
                if (b >= 1E9) return (b / 1E9).toFixed(2) + " Gbit/s";
                if (b >= 1E6) return (b / 1E6).toFixed(2) + " Mbit/s";
                if (b >=
                    1E3) return (b / 1E3).toFixed(2) + " kbit/s";
                return b.toFixed(2) + " bit/s"
            },
            _formatTime: function(b) {
                var c = new Date(b * 1E3);
                b = (b = parseInt(b / 86400, 10)) ? b + "d " : "";
                return b + ("0" + c.getUTCHours()).slice(-2) + ":" + ("0" + c.getUTCMinutes()).slice(-2) + ":" + ("0" + c.getUTCSeconds()).slice(-2)
            },
            _formatPercentage: function(b) {
                return (b * 100).toFixed(2) + " %"
            },
            _renderExtendedProgress: function(b) {
                return this._formatBitrate(b.bitrate) + " | " + this._formatTime((b.total - b.loaded) * 8 / b.bitrate) + " | " + this._formatPercentage(b.loaded / b.total) +
                    " | " + this._formatFileSize(b.loaded) + " / " + this._formatFileSize(b.total)
            },
            _hasError: function(b) {
                if (b.error) return b.error;
                if (this.options.maxNumberOfFiles < 0) return this.options.customErrors && this.options.customErrors.maxNumberOfFilesExceeded ? this.options.customErrors.maxNumberOfFilesExceeded : "Maximum number of files exceeded";
                if (!(this.options.acceptFileTypes.test(b.type) || this.options.acceptFileTypes.test(b.name))) return "Filetype not allowed";
                if (this.options.maxFileSize && b.size > this.options.maxFileSize) {
                    this._errorCallback &&
                        this._errorCallback();
                    return this.options.customErrors && this.options.customErrors.fileIsTooBig ? this.options.customErrors.fileIsTooBig : "File is too big"
                }
                if (typeof b.size === "number" && b.size < this.options.minFileSize) return "File is too small";
                return null
            },
            _validate: function(b) {
                var c = this,
                    d = !!b.length;
                j.each(b, function(a, e) {
                    e.error = c._hasError(e);
                    if (e.error) d = false
                });
                return d
            },
            _renderTemplate: function(b, c) {
                if (!b) return j();
                var d = b({
                    files: c,
                    formatFileSize: this._formatFileSize,
                    options: this.options
                });
                if (d instanceof j) return d;
                return j(this.options.templatesContainer).html(d).children()
            },
            _renderPreview: function(b, c) {
                var d = this,
                    a = this.options,
                    e = j.Deferred();
                return (h && h(b, function(g) {
                    c.empty();
                    c.append(g);
                    d._forceReflow(c);
                    d._transition(c).done(function() {
                        e.resolveWith(c)
                    });
                    j.contains(d.document[0].body, c[0]) || e.resolveWith(c)
                }, {
                    maxWidth: a.previewMaxWidth,
                    maxHeight: a.previewMaxHeight,
                    canvas: a.previewAsCanvas
                }) || e.resolveWith(c)) && e
            },
            _renderPreviews: function(b) {
                var c = this,
                    d = this.options;
                b.context.find(".preview span").each(function(a,
                    e) {
                    var g = b.files[a];
                    if (d.previewSourceFileTypes.test(g.type) && (j.type(d.previewSourceMaxFileSize) !== "number" || g.size < d.previewSourceMaxFileSize)) c._processingQueue = c._processingQueue.pipe(function() {
                        var k = j.Deferred(),
                            l = j.Event("previewdone", {
                                target: e
                            });
                        c._renderPreview(g, j(e)).done(function() {
                            c._trigger(l.type, l, b);
                            k.resolveWith(c)
                        });
                        return k.promise()
                    })
                });
                return this._processingQueue
            },
            _renderUpload: function(b) {
                return this._renderTemplate(this.options.uploadTemplate, b)
            },
            _renderDownload: function(b) {
                return this._renderTemplate(this.options.downloadTemplate,
                    b).find("a[download]").each(this._enableDragToDesktop).end()
            },
            _startHandler: function(b) {
                b.preventDefault();
                b = j(b.currentTarget);
                var c = b.closest(".template-upload").data("data");
                c && c.submit && !c.jqXHR && c.submit() && b.prop("disabled", true)
            },
            _cancelHandler: function(b) {
                b.preventDefault();
                var c = j(b.currentTarget).closest(".template-upload").data("data") || {};
                this._notifyAboutResultChanges();
                this._removeFileCallback && this._removeFileCallback();
                if (c.jqXHR) c.jqXHR.abort();
                else {
                    c.errorThrown = "abort";
                    this._trigger("fail",
                        b, c)
                }
            },
            _deleteHandler: function(b) {
                b.preventDefault();
                var c = j(b.currentTarget);
                this._trigger("destroy", b, j.extend({
                    context: c.closest(".template-download"),
                    type: "POST",
                    dataType: this.options.dataType
                }, c.data()))
            },
            _forceReflow: function(b) {
                return j.support.transition && b.length && b[0].offsetWidth
            },
            _transition: function(b) {
                var c = j.Deferred();
                if (j.support.transition && b.hasClass("fade")) b.bind(j.support.transition.end, function(d) {
                    if (d.target === b[0]) {
                        b.unbind(j.support.transition.end);
                        c.resolveWith(b)
                    }
                }).toggleClass("in");
                else {
                    b.toggleClass("in");
                    c.resolveWith(b)
                }
                return c
            },
            _initButtonBarEventHandlers: function() {
                var b = this.element.find(".fileupload-buttonbar"),
                    c = this.options.filesContainer;
                this._on(b.find(".start"), {
                    click: function(d) {
                        d.preventDefault();
                        c.find(".start button").click()
                    }
                });
                this._on(b.find(".cancel"), {
                    click: function(d) {
                        d.preventDefault();
                        c.find(".cancel button").click()
                    }
                });
                this._on(b.find(".delete"), {
                    click: function(d) {
                        d.preventDefault();
                        c.find(".delete input:checked").siblings("button").click();
                        b.find(".toggle").prop("checked",
                            false)
                    }
                });
                this._on(b.find(".toggle"), {
                    change: function(d) {
                        c.find(".delete input").prop("checked", j(d.currentTarget).is(":checked"))
                    }
                })
            },
            _destroyButtonBarEventHandlers: function() {
                this._off(this.element.find(".fileupload-buttonbar button"), "click");
                this._off(this.element.find(".fileupload-buttonbar .toggle"), "change.")
            },
            _initEventHandlers: function() {
                this._super();
                this._on(this.options.filesContainer, {
                    "click .start button": this._startHandler,
                    "click .cancel button": this._cancelHandler,
                    "click .delete .button": this._deleteHandler
                });
                this._initButtonBarEventHandlers()
            },
            _destroyEventHandlers: function() {
                this._destroyButtonBarEventHandlers();
                this._off(this.options.filesContainer, "click");
                this._super()
            },
            _enableFileInputButton: function() {
                this.element.find(".ccl-fileuploader-button input").prop("disabled", false).parent().removeClass("disabled")
            },
            _disableFileInputButton: function() {
                this.element.find(".ccl-fileuploader-button input").prop("disabled", true).parent().addClass("disabled")
            },
            _initTemplates: function() {
                var b = this.options;
                b.templatesContainer =
                    this.document[0].createElement(b.filesContainer.prop("nodeName"));
                if (f) {
                    if (b.uploadTemplateId) b.uploadTemplate = f(b.uploadTemplateId);
                    if (b.downloadTemplateId) b.downloadTemplate = f(b.downloadTemplateId)
                }
            },
            _initFilesContainer: function() {
                var b = this.options;
                if (b.filesContainer === undefined) b.filesContainer = this.element.find(".files");
                else if (!(b.filesContainer instanceof j)) b.filesContainer = j(b.filesContainer)
            },
            _stringToRegExp: function(b) {
                b = b.split("/");
                var c = b.pop();
                b.shift();
                return RegExp(b.join("/"),
                    c)
            },
            _initRegExpOptions: function() {
                var b = this.options;
                if (j.type(b.acceptFileTypes) === "string") b.acceptFileTypes = this._stringToRegExp(b.acceptFileTypes);
                if (j.type(b.previewSourceFileTypes) === "string") b.previewSourceFileTypes = this._stringToRegExp(b.previewSourceFileTypes)
            },
            _initSpecialOptions: function() {
                this._super();
                this._initFilesContainer();
                this._initTemplates();
                this._initRegExpOptions()
            },
            _setOption: function(b, c) {
                this._super(b, c);
                b === "maxNumberOfFiles" && this._adjustMaxNumberOfFiles(0)
            },
            _create: function() {
                this._super();
                this._refreshOptionsList.push("filesContainer", "uploadTemplateId", "downloadTemplateId");
                if (!this._processingQueue) {
                    this._processingQueue = j.Deferred().resolveWith(this).promise();
                    this.process = function() {
                        return this._processingQueue
                    }
                }
                this._resetFinishedDeferreds()
            },
            enable: function() {
                var b = false;
                if (this.options.disabled) b = true;
                this._super();
                if (b) {
                    this.element.find("input, button").prop("disabled", false);
                    this._enableFileInputButton()
                }
            },
            disable: function() {
                if (!this.options.disabled) {
                    this.element.find("input, button").prop("disabled",
                        true);
                    this._disableFileInputButton()
                }
                this._super()
            },
            emptyFileList: function() {
                this.options.filesContainer.find(".delete .button, .cancel button").click()
            },
            clearResults: function() {
                j(this.options.filesContainer[0]).find("tr").each(function() {
                    var b = j(this);
                    b.hasClass("clearme") || b.find(".error").length === 0 ? b.remove() : b.addClass("clearme")
                });
                if (this._fileList) {
                    this._adjustMaxNumberOfFiles(this._fileList.length);
                    this._fileList.length = 0;
                    this._fileListKeys.length = 0
                }
                this.options.stateHiddenField.val(JSON.stringify(this._fileList));
                this._notifyAboutResultChanges()
            },
            allowHide: function() {
                return j(this.options.filesContainer[0]).find("tr .error").length === 0
            },
            abortAllUploads: function() {
                if (this._uploadsList) {
                    var b = this;
                    j.each(this._uploadsList, function(c, d) {
                        if (d.data.jqXHR) d.data.jqXHR.abort();
                        else {
                            d.data.errorThrown = "abort";
                            b._trigger("fail", d, d.data)
                        }
                    })
                }
            },
            getUploadedFiles: function() {
                return this._fileList || []
            },
            setStartUploadCallback: function(b) {
                if (typeof b == "function") this._startUploadCallback = b
            },
            setStopUploadCallback: function(b) {
                if (typeof b ==
                    "function") this._stopUploadCallback = b
            },
            setAddFileCallback: function(b) {
                if (typeof b == "function") this._addFileCallback = b
            },
            setRemoveFileCallback: function(b) {
                if (typeof b == "function") this._removeFileCallback = b
            },
            setErrorCallback: function(b) {
                if (typeof b == "function") this._errorCallback = b
            },
            setAdditionalClientValidationCallback: function(b) {
                if (typeof b == "function") this._additionalClientValidationCallback = b
            },
            renderHiddenFieldContent: function() {
                var b = this.options,
                    c = this.options.stateHiddenField.val();
                if ((c = c ? JSON.parse(c) : []) && c.length > 0) {
                    var d = this._renderDownload(c);
                    d.appendTo(b.filesContainer);
                    var a = [];
                    j.each(c, function(g, k) {
                        if (!k.error || k.error.length == 0) a.push(k)
                    });
                    a.length > 0 && this._addFilesToList(a);
                    this._adjustMaxNumberOfFiles(b.singleFileMode ? -c.length : -a.length);
                    var e = [];
                    j.each(c, function(g, k) {
                        if (k.type && b.previewSourceFileTypes.test(k.type) && k.fileUrl) {
                            e.push(k);
                            e[e.length - 1].toString = function() {
                                return k.fileUrl
                            }
                        }
                    });
                    e.length > 0 && this._renderPreviews({
                        context: d.data("data", {
                            files: c
                        }),
                        files: e
                    })
                }
            }
        })
    });
var FixedHeader;
(function(j, f, h) {
    FixedHeader = function(b, c) {
        if (b)
            if (!this instanceof FixedHeader) alert("FixedHeader warning: FixedHeader must be initialised with the 'new' keyword.");
            else {
                var d = {
                    aoCache: [],
                    oSides: {
                        top: true,
                        bottom: false,
                        left: 0,
                        right: 0
                    },
                    oZIndexes: {
                        top: 104,
                        bottom: 103,
                        left: 102,
                        right: 101,
                        topLeft: 105
                    },
                    oCloneOnDraw: {
                        top: false,
                        bottom: false,
                        left: true,
                        right: true
                    },
                    oMes: {
                        iTableWidth: 0,
                        iTableHeight: 0,
                        iTableLeft: 0,
                        iTableRight: 0,
                        iTableTop: 0,
                        iTableBottom: 0
                    },
                    oOffset: {
                        top: 0
                    },
                    nTable: null,
                    bFooter: false,
                    bInitComplete: false
                };
                this.fnGetSettings = function() {
                    return d
                };
                this.fnUpdate = function() {
                    this._fnUpdateClones();
                    this._fnUpdatePositions()
                };
                this.fnPosition = function() {
                    this._fnUpdatePositions()
                };
                this.fnInit(b, c);
                if (typeof b.fnSettings == "function") b._oPluginFixedHeader = this
            }
    };
    FixedHeader.prototype = {
        fnInit: function(b, c) {
            var d = this.fnGetSettings(),
                a = this;
            this.fnInitSettings(d, c);
            d.nTable = b;
            d.bFooter = h(">tfoot", d.nTable).length > 0 ? true : false;
            d.oSides.left && d.aoCache.push(a._fnCloneTable("fixedLeft", "FixedHeader_Left", a._fnCloneTLeft,
                d.oSides.left));
            d.oSides.top && d.oSides.left && d.aoCache.push(a._fnCloneTable("fixedTopLeft", "FixedHeader_TopLeft", a._fnCloneTTopLeft, d.oSides.left));
            d.oSides.top && d.aoCache.push(a._fnCloneTable("fixedHeader", "FixedHeader_Header", a._fnCloneThead));
            FixedHeader.afnScroll.push(function() {
                a._fnUpdatePositions.call(a)
            });
            h(j).resize(function() {
                FixedHeader.fnCalculatePosition()
            });
            d.frameSizeChangedEvent && h(j).bind(d.frameSizeChangedEvent, function() {
                FixedHeader.fnCalculatePosition()
            });
            h(d.nTable).on("column-reorder column-visibility",
                function() {
                    FixedHeader.fnMeasure();
                    a._fnUpdateClones(true);
                    a._fnUpdatePositions()
                }).on("row-resize", function() {
                a._fnFindEqualiseTLeftRowsHeight()
            });
            FixedHeader.fnMeasure();
            a._fnUpdateClones();
            a._fnUpdatePositions();
            a._fnRemoveExcessIdentifiers();
            d.bInitComplete = true
        },
        fnInitSettings: function(b, c) {
            if (c !== undefined) {
                if (c.top !== undefined) b.oSides.top = c.top;
                if (c.bottom !== undefined) b.oSides.bottom = c.bottom;
                if (typeof c.left == "boolean") b.oSides.left = c.left ? 1 : 0;
                else if (c.left !== undefined) b.oSides.left = c.left;
                if (typeof c.right == "boolean") b.oSides.right = c.right ? 1 : 0;
                else if (c.right !== undefined) b.oSides.right = c.right;
                if (c.zTop !== undefined) b.oZIndexes.top = c.zTop;
                if (c.zBottom !== undefined) b.oZIndexes.bottom = c.zBottom;
                if (c.zLeft !== undefined) b.oZIndexes.left = c.zLeft;
                if (c.zRight !== undefined) b.oZIndexes.right = c.zRight;
                if (c.offsetTop !== undefined) b.oOffset.top = c.offsetTop;
                if (c.alwaysCloneTop !== undefined) b.oCloneOnDraw.top = c.alwaysCloneTop;
                if (c.alwaysCloneBottom !== undefined) b.oCloneOnDraw.bottom = c.alwaysCloneBottom;
                if (c.alwaysCloneLeft !== undefined) b.oCloneOnDraw.left = c.alwaysCloneLeft;
                if (c.alwaysCloneRight !== undefined) b.oCloneOnDraw.right = c.alwaysCloneRight;
                if (c.frameSizeChangedEvent != undefined) b.frameSizeChangedEvent = c.frameSizeChangedEvent
            }
        },
        _fnCloneTable: function(b, c, d, a) {
            var e = this.fnGetSettings(),
                g;
            g = e.nTable.cloneNode(false);
            g.removeAttribute("id");
            var k = f.createElement("div");
            k.style.position = "absolute";
            k.style.top = "0px";
            k.style.left = "0px";
            k.className += " FixedHeader_Cloned " + b + " " + c;
            if (b == "fixedHeader") k.style.zIndex =
                e.oZIndexes.top;
            if (b == "fixedLeft") k.style.zIndex = e.oZIndexes.left;
            if (b == "fixedTopLeft") k.style.zIndex = e.oZIndexes.topLeft;
            g.style.margin = "0";
            k.appendChild(g);
            f.body.appendChild(k);
            return {
                nNode: g,
                nWrapper: k,
                sType: b,
                sPosition: "",
                sTop: "",
                sLeft: "",
                fnClone: d,
                iCells: a
            }
        },
        _fnMeasure: function() {
            var b = this.fnGetSettings(),
                c = b.oMes,
                d = h(b.nTable),
                a = d.offset(),
                e = this._fnSumScroll(b.nTable.parentNode, "scrollTop");
            this._fnSumScroll(b.nTable.parentNode, "scrollLeft");
            c.iTableWidth = d.outerWidth();
            c.iTableHeight = d.outerHeight();
            c.iTableLeft = a.left + b.nTable.parentNode.scrollLeft;
            c.iTableTop = a.top + e;
            c.iTableRight = c.iTableLeft + c.iTableWidth;
            c.iTableRight = FixedHeader.oDoc.iWidth - c.iTableLeft - c.iTableWidth;
            c.iTableBottom = FixedHeader.oDoc.iHeight - c.iTableTop - c.iTableHeight
        },
        _fnSumScroll: function(b, c) {
            for (var d = b[c]; b = b.parentNode;) {
                if (b.nodeName == "HTML" || b.nodeName == "BODY") break;
                d = b[c]
            }
            return d
        },
        _fnUpdatePositions: function() {
            var b = this.fnGetSettings();
            this._fnMeasure();
            for (var c = 0, d = b.aoCache.length; c < d; c++)
                if (b.aoCache[c].sType ==
                    "fixedHeader") this._fnScrollFixedHeader(b.aoCache[c]);
                else if (b.aoCache[c].sType == "fixedLeft") this._fnScrollHorizontalLeft(b.aoCache[c]);
            else b.aoCache[c].sType == "fixedTopLeft" && this._fnScrollHorisontalOrVerticalTopLeft(b.aoCache[c])
        },
        _fnRemoveExcessIdentifiers: function() {
            var b = this.fnGetSettings();
            h("thead", b.nTable).find(":not(input[type=hidden])").removeAttr("id").removeAttr("name");
            h("td:nth-child(-n+" + b.oSides.left + ")", b.nTable).find(":not(input[type=hidden])").andSelf().removeAttr("id").removeAttr("name");
            for (var c = 0, d = b.aoCache.length; c < d; c++) {
                var a = b.aoCache[c].nNode;
                h("input[type=hidden]", a).remove();
                switch (b.aoCache[c].sType) {
                    case "fixedHeader":
                        h("th:nth-child(-n+" + b.oSides.left + ")", a).children().andSelf().removeAttr("id").removeAttr("name");
                        break;
                    case "fixedLeft":
                        h("thead", a).find("*").removeAttr("id").removeAttr("name")
                }
            }
        },
        _fnUpdateClones: function(b) {
            var c = this.fnGetSettings();
            if (b) c.bInitComplete = false;
            for (var d = 0, a = c.aoCache.length; d < a; d++) c.aoCache[d].fnClone.call(this, c.aoCache[d]);
            if (b) c.bInitComplete =
                true
        },
        _fnClearTableColumnWidths: function() {},
        _fnScrollHorizontalLeft: function(b) {
            var c = this.fnGetSettings().oMes,
                d = FixedHeader.oWin,
                a = b.nWrapper,
                e = h(a).outerWidth();
            if (d.iScrollLeft < c.iTableLeft) {
                this._fnUpdateCache(b, "sPosition", "absolute", "position", a.style);
                this._fnUpdateCache(b, "sTop", c.iTableTop + "px", "top", a.style);
                this._fnUpdateCache(b, "sLeft", c.iTableLeft + "px", "left", a.style)
            } else if (d.iScrollLeft < c.iTableLeft + c.iTableWidth - e) {
                this._fnUpdateCache(b, "sPosition", "fixed", "position", a.style);
                this._fnUpdateCache(b,
                    "sTop", c.iTableTop - d.iScrollTop + "px", "top", a.style);
                this._fnUpdateCache(b, "sLeft", "0px", "left", a.style)
            } else {
                this._fnUpdateCache(b, "sPosition", "absolute", "position", a.style);
                this._fnUpdateCache(b, "sTop", c.iTableTop + "px", "top", a.style);
                this._fnUpdateCache(b, "sLeft", c.iTableLeft + c.iTableWidth - e + "px", "left", a.style)
            }
        },
        _fnScrollHorisontalOrVerticalTopLeft: function(b) {
            var c = this.fnGetSettings(),
                d = c.oMes,
                a = FixedHeader.oWin,
                e = b.nWrapper,
                g = h(e).outerWidth();
            c.nTable.getElementsByTagName("tbody");
            if (a.iScrollLeft <
                d.iTableLeft && d.iTableTop > a.iScrollTop + c.oOffset.top) {
                this._fnUpdateCache(b, "sPosition", "absolute", "position", e.style);
                this._fnUpdateCache(b, "sTop", d.iTableTop + "px", "top", e.style);
                this._fnUpdateCache(b, "sLeft", d.iTableLeft + "px", "left", e.style)
            } else if (d.iTableTop > a.iScrollTop + c.oOffset.top)
                if (a.iScrollLeft < d.iTableLeft) {
                    this._fnUpdateCache(b, "sPosition", "absolute", "position", e.style);
                    this._fnUpdateCache(b, "sTop", d.iTableTop + "px", "top", e.style);
                    this._fnUpdateCache(b, "sLeft", d.iTableLeft + "px", "left",
                        e.style)
                } else if (a.iScrollLeft < d.iTableLeft + d.iTableWidth - g) {
                this._fnUpdateCache(b, "sPosition", "fixed", "position", e.style);
                this._fnUpdateCache(b, "sTop", d.iTableTop - a.iScrollTop + "px", "top", e.style);
                this._fnUpdateCache(b, "sLeft", "0px", "left", e.style)
            } else {
                this._fnUpdateCache(b, "sPosition", "absolute", "position", e.style);
                this._fnUpdateCache(b, "sTop", d.iTableTop + "px", "top", e.style);
                this._fnUpdateCache(b, "sLeft", d.iTableLeft + d.iTableWidth - g + "px", "left", e.style)
            } else {
                this._fnUpdateCache(b, "sPosition", "fixed",
                    "position", e.style);
                this._fnUpdateCache(b, "sTop", c.oOffset.top + "px", "top", e.style);
                a.iScrollLeft < d.iTableLeft ? this._fnUpdateCache(b, "sLeft", d.iTableLeft - a.iScrollLeft + "px", "left", e.style) : this._fnUpdateCache(b, "sLeft", "0px", "left", e.style)
            }
        },
        _fnScrollFixedHeader: function(b) {
            for (var c = this.fnGetSettings(), d = c.oMes, a = FixedHeader.oWin, e = b.nWrapper, g = 0, k = c.nTable.getElementsByTagName("tbody"), l = 0; l < k.length; ++l) g += k[l].offsetHeight;
            if (d.iTableTop > a.iScrollTop + c.oOffset.top) {
                this._fnUpdateCache(b, "sPosition",
                    "absolute", "position", e.style);
                this._fnUpdateCache(b, "sTop", d.iTableTop + "px", "top", e.style);
                this._fnUpdateCache(b, "sLeft", d.iTableLeft + "px", "left", e.style)
            } else if (a.iScrollTop + c.oOffset.top > d.iTableTop + g) {
                this._fnUpdateCache(b, "sPosition", "absolute", "position", e.style);
                this._fnUpdateCache(b, "sTop", d.iTableTop + g + "px", "top", e.style);
                this._fnUpdateCache(b, "sLeft", d.iTableLeft + "px", "left", e.style)
            } else {
                this._fnUpdateCache(b, "sPosition", "fixed", "position", e.style);
                this._fnUpdateCache(b, "sTop", c.oOffset.top +
                    "px", "top", e.style);
                this._fnUpdateCache(b, "sLeft", d.iTableLeft - a.iScrollLeft + "px", "left", e.style)
            }
        },
        _fnUpdateCache: function(b, c, d, a, e) {
            if (b[c] != d) {
                e[a] = d;
                b[c] = d
            }
        },
        _fnClassUpdate: function(b, c) {
            var d = this;
            if (b.nodeName.toUpperCase() === "TR" || b.nodeName.toUpperCase() === "TH" || b.nodeName.toUpperCase() === "TD" || b.nodeName.toUpperCase() === "SPAN") c.className = b.className;
            h(b).children().each(function(a) {
                d._fnClassUpdate(h(b).children()[a], h(c).children()[a])
            })
        },
        _fnCloneThead: function(b) {
            var c = this.fnGetSettings(),
                d = b.nNode;
            if (c.bInitComplete && !c.oCloneOnDraw.top) this._fnClassUpdate(h("thead", c.nTable)[0], h("thead", d)[0]);
            else {
                var a = h(c.nTable).outerWidth();
                b.nWrapper.style.width = a + "px";
                for (d.style.width = a + "px"; d.childNodes.length > 0;) {
                    h("thead th", d).unbind("click");
                    d.removeChild(d.childNodes[0])
                }
                b = h("thead", c.nTable).clone(true, true)[0];
                d.appendChild(b);
                var e = [],
                    g = [];
                h("thead>tr th", c.nTable).each(function() {
                    e.push(h(this).width())
                });
                h("thead>tr td", c.nTable).each(function() {
                    g.push(h(this).width())
                });
                h("thead>tr th",
                    c.nTable).each(function(k) {
                    h("thead>tr th:eq(" + k + ")", d).width(e[k]);
                    h(this).width(e[k])
                });
                h("thead>tr td", c.nTable).each(function(k) {
                    h("thead>tr td:eq(" + k + ")", d).width(g[k]);
                    h(this).width(g[k])
                })
            }
        },
        _fnCloneTLeft: function(b) {
            for (var c = this.fnGetSettings(), d = b.nNode, a = h("tbody", c.nTable)[0]; d.childNodes.length > 0;) d.removeChild(d.childNodes[0]);
            d.appendChild(h("thead", c.nTable).clone(true)[0]);
            d.appendChild(h("tbody", c.nTable).clone(true)[0]);
            var e = "gt(" + (b.iCells - 1) + ")";
            h("thead tr", d).each(function() {
                h("th:" +
                    e, this).remove()
            });
            h("tbody tr", d).each(function() {
                h("td:" + e, this).remove()
            });
            this._fnEqualiseRowsHeight(c, b, a, d);
            for (var g = a = 0; g < b.iCells; g++) a += h("thead tr th:eq(" + g + ")", c.nTable).outerWidth();
            d.style.width = a + "px";
            b.nWrapper.style.width = a + "px"
        },
        _fnEqualiseRowsHeight: function(b, c, d, a) {
            h("tr", a).removeClass("ccl-table-highlight");
            h("tr", b.nTable).height("auto");
            this._fnEqualiseHeights("thead", d.parentNode, a);
            this._fnEqualiseHeights("tbody", d.parentNode, a)
        },
        _fnFindEqualiseTLeftRowsHeight: function() {
            var b =
                this.fnGetSettings();
            this._fnMeasure();
            for (var c = 0, d = b.aoCache.length; c < d; c++)
                if (b.aoCache[c].sType == "fixedLeft") {
                    var a = b.aoCache[c],
                        e = h("tbody", b.nTable)[0];
                    this._fnEqualiseRowsHeight(b, a, e, a.nNode)
                }
        },
        _fnCloneTTopLeft: function(b) {
            var c = this.fnGetSettings(),
                d = b.nNode;
            for (h("tbody", c.nTable); d.childNodes.length > 0;) d.removeChild(d.childNodes[0]);
            d.appendChild(h("thead", c.nTable).clone(true)[0]);
            var a = "gt(" + (b.iCells - 1) + ")";
            h("thead tr", d).each(function() {
                h("th:" + a, this).remove()
            });
            for (var e = 0, g = 0; g <
                b.iCells; g++) e += h("thead tr th:eq(" + g + ")", c.nTable).outerWidth();
            d.style.width = e + "px";
            b.nWrapper.style.width = e + "px"
        },
        _fnEqualiseHeights: function(b, c, d) {
            var a = h(b + " tr", c),
                e;
            h(b + " tr", d).each(function(g) {
                e = a.eq(g).css("height");
                if (navigator.appName == "Microsoft Internet Explorer") e = parseInt(e, 10) + 1;
                h(this).css("height", e);
                a.eq(g).css("height", e)
            })
        }
    };
    FixedHeader.oWin = {
        iScrollTop: 0,
        iScrollRight: 0,
        iScrollBottom: 0,
        iScrollLeft: 0,
        iHeight: 0,
        iWidth: 0
    };
    FixedHeader.oDoc = {
        iHeight: 0,
        iWidth: 0
    };
    FixedHeader.afnScroll = [];
    FixedHeader.fnMeasure = function() {
        var b = h(j),
            c = h(f),
            d = FixedHeader.oWin,
            a = FixedHeader.oDoc;
        a.iHeight = c.height();
        a.iWidth = c.width();
        d.iHeight = b.height();
        d.iWidth = b.width();
        d.iScrollTop = b.scrollTop();
        d.iScrollLeft = b.scrollLeft();
        d.iScrollRight = a.iWidth - d.iScrollLeft - d.iWidth;
        d.iScrollBottom = a.iHeight - d.iScrollTop - d.iHeight
    };
    FixedHeader.VERSION = "2.1.0-dev";
    FixedHeader.prototype.VERSION = FixedHeader.VERSION;
    FixedHeader.fnCalculatePosition = function() {
        FixedHeader.fnMeasure();
        for (var b = 0, c = FixedHeader.afnScroll.length; b <
            c; b++) FixedHeader.afnScroll[b]()
    };
    h(j).scroll(function() {
        FixedHeader.fnCalculatePosition()
    })
})(window, document, jQuery);

function FolderSelector(j) {
    window[j.clientId] = this;
    var f = this;
    f.id = j.clientId;
    f.rootId = "0";
    f.rootTitle = "";
    f.hideRootCrumb = false;
    f.selectedId = "";
    f.parentId = "";
    f.cache = {};
    f.loadingTreshold = j.loadingTreshold;
    f.insertFeedbackClientId = j.insertFeedbackClientId;
    f.showBreadCrumbs = j.showBreadCrumbs === "true";
    f.controls = {
        dialog: window[j.dialogClientId],
        grid: window[j.gridClientId]
    };
    f.dialogContainer = $("#" + j.dialogClientId);
    f.gridContainer = f.dialogContainer.find("." + j.cssClasses.gridContainer);
    f.treeContainer =
        f.dialogContainer.find("." + j.cssClasses.treeContainer);
    f.navigation = f.dialogContainer.find("." + j.cssClasses.navigation);
    f.loadingIndicator = f.dialogContainer.find("." + j.cssClasses.loadingIndicator);
    f.dialogContainer.addClass(j.cssClasses.folderSelector);
    f.gridContainer.addClass(j.cssClasses.hidecontents);
    f.treeContainer.addClass(j.cssClasses.hidecontents);
    f.openDialog = function(b) {
        f.hideSelectFeedback();
        f.initializeCurrentView(b);
        window[j.dialogClientId].openDialog()
    };
    f.buildStructure = function() {
        f.reinitialize();
        $(f).trigger(j.eventNames.open);
        return false
    };
    f.disposeStructure = function() {
        $(f).trigger(j.eventNames.close);
        f.treeContainer.empty();
        delete f.controls.tree
    };
    f.reinitialize = function(b, c) {
        if (b) f.cache = {};
        f.treeContainer.empty();
        delete f.controls.tree;
        f.selectedId = "";
        f.parentId = "";
        f.navigateUpButtonDisable();
        f.showBreadCrumbs && h(0);
        f.hideSelectFeedback();
        f.initializeCurrentView(c);
    };
    f.initializeCurrentView = function(b) {
        if (b) {
            f.rootId = "0";
            if (b.ReadDataServiceUrl != "") f.controls.grid.dataSourceWebMethodUrl =
                b.ReadDataServiceUrl
        }
    };
    f.showEmptyContentFeedback = function() {
        f.dialogContainer.find("." + j.cssClasses.content).hide();
        f.navigation.hide();
        f.dialogContainer.find("." + j.cssClasses.emptyContent).show()
    };
    f.controls.grid.refresh = function() {
        f.navigateToPage(f.controls.grid.pageNumber, f.controls.grid.pageSize)
    };
    f.baseToggleSelect = f.controls.grid.toggleSelect;
    f.controls.grid.toggleSelect = function(b) {
        f.baseToggleSelect(b);
        b = f.controls.grid.getSelectedValues();
        $(f).trigger("gridSelectionChange", [{
            nodeIds: b
        }])
    };
    f.baseToggleSelectAll = f.controls.grid.toggleSelectAll;
    f.controls.grid.toggleSelectAll = function(b) {
        f.baseToggleSelectAll(b);
        b = f.controls.grid.getSelectedValues();
        $(f).trigger("gridSelectionChange", [{
            nodeIds: b
        }])
    };
    $(f).on("gridSelectionChange", function(b, c) {
        var d = c.nodeIds.length > 0,
            a = f.gridContainer.find("." + j.cssClasses.selectButton).parent("li");
        d ? a.removeClass(j.cssClasses.disabled) : a.addClass(j.cssClasses.disabled)
    });
    f.enableSelectButton = function(b) {
        f.gridContainer.find("." + j.cssClasses.selectButton).parent("li").toggleClass(j.cssClasses.disabled, !b)
    };
    f.gridContainer.on("click", "a." + j.cssClasses.selectButton, function() {
        if ($(this).parent("li").hasClass(j.cssClasses.disabled)) return false;
        var b = f.controls.grid.getSelectedValues();
        $(f).trigger(j.eventNames.select, [{
            selectedId: f.selectedId,
            nodeIds: b
        }]);
        return false
    });
    f.gridContainer.on("click", "a." + j.cssClasses.folderLink, function() {
        f.navigateToNode($(this).attr("folderId"));
        return false
    });
    f.gridContainer.on("click", "a." + j.cssClasses.navigateUpLink, function() {
        if ($(this).parent("li").hasClass(j.cssClasses.disabled)) return false;
        if (f.parentId && f.parentId != "0" || f.parentId == "0" && f.rootId == "0")
            if (f.selectedId == f.rootId) {
                f.rootId = f.parentId;
                f.reinitialize();
                f.showBreadCrumbs && h()
            } else f.navigateToNode(f.parentId);
        return false
    });
    f._loadTreeData = function(b, c) {
        var d = (b.data ? b.attr("nodeId") : undefined) || f.rootId;
        f.getData(d, 1, f.controls.grid.pageSize, function(a) {
            a = f.getCachedFolderData(a);
            if (!f.showFeedbackOnEmpty || !f.isContentEmpty(d, a)) {
                for (var e = -1, g = [], k = a.folders.length, l = 0; l < k; l++) {
                    var o = a.folders[l];
                    g.push({
                        data: {
                            title: o.title,
                            icon: o.cssClass
                        },
                        attr: {
                            nodeId: o.id
                        },
                        state: "closed"
                    });
                    if (o.selectedByDefault && e < 0) e = l
                }
                c(g);
                if (f.selectedId ===
                    "") {
                    f.selectedId = f.rootId;
                    f.renderGrid(f.selectedId, 1, f.controls.grid.pageSize);
                    if (e >= 0 && e < k) {
                        f.hideRootCrumb = true;
                        f.navigateToNode(a.folders[e].id, true)
                    }
                }
            } else f.showEmptyContentFeedback()
        })
    };
    f.isContentEmpty = function(b, c) {
        if (b == "0") return c.folders.length == 0 && c.items.pages[1].length == 0;
        return false
    };
    f.navigateToNode = function(b, c) {
        if (b != f.selectedId) {
            f.hideSelectFeedback();
            f.treeContainer.find("li").removeClass(j.cssClasses.selected);
            var d = f.treeContainer.find("li[nodeId=" + b + "]");
            d.addClass(j.cssClasses.selected);
            f.showBreadCrumbs && h(d);
            f.getData(b, 1, f.controls.grid.pageSize, function(a) {
                f.selectedId = a;
                if (c) f.rootId = a;
                f.navigateUpButtonDisable();
                f.renderGrid(a, 1, f.controls.grid.pageSize);
                d[0] && f.controls.tree.open_node(d)
            })
        }
    };
    f.navigateToPage = function(b, c) {
        f.hideSelectFeedback();
        f.getData(f.selectedId, b, c, function() {
            f.renderGrid(f.selectedId, b, c);
            f.controls.dialog.adjustWindowSize()
        })
    };
    f.getData = function(b, c, d, a) {
        c = c || f.controls.grid.page;
        d = d || f.controls.grid.pageSize;
        if (f.hasCachedFolderData(b) && f.hasCachedItemData(b,
            c, d)) a(b);
        else {
            f.showLoadingIndicator();
            $(f).trigger(j.eventNames.loadStart, [{
                nodeId: b,
                page: c,
                pageSize: d
            }]);
            $.ajax({
                type: "GET",
                url: f.controls.grid.dataSourceWebMethodUrl,
                data: f.getRequestData(b, c, d),
                dataType: "jsonp",
                success: function(e) {
                    var g = $.Event(j.eventNames.loadComplete);
                    $(f).trigger(g, [{
                        success: true,
                        data: e
                    }]);
                    if (!g.isPropagationStopped()) {
                        if (b == f.rootId) {
                            f.rootId = e.Id;
                            f.rootTitle = e.Title;
                            f.showBreadCrumbs && h()
                        }
                        f.cacheData(e, e.Id, c, d);
                        a(e.Id);
                        f.hideLoadingIndicator()
                    }
                },
                error: function() {
                    $(f).trigger(j.eventNames.loadComplete, [{
                        success: false
                    }]);
                    f.hideLoadingIndicator()
                }
            })
        }
    };
    f.showLoadingIndicator = function() {
        clearTimeout(f.loadingTimeout);
        f.loadingTimeout = setTimeout(function() {
            f.loadingIndicator.show()
        }, f.loadingTreshold)
    };
    f.hideLoadingIndicator = function() {
        clearTimeout(f.loadingTimeout);
        f.loadingIndicator.hide();
        f.gridContainer.removeClass(j.cssClasses.hidecontents);
        f.treeContainer.removeClass(j.cssClasses.hidecontents)
    };
    f.getCachedFolderData = function(b) {
        return f.cache[b]
    };
    f.getCachedItemData = function(b, c, d) {
        b = f.cache[b];
        if (b !== undefined && b !== null) {
            b = b.items || {};
            if (b.pageSize === d && b.pages) return b.pages[c.toString()]
        }
    };
    f.hasCachedFolderData = function(b) {
        b = f.getCachedFolderData(b);
        return b !== undefined && b !== null
    };
    f.hasCachedItemData = function(b, c, d) {
        b = f.getCachedItemData(b, c, d);
        return b !== undefined && b !== null
    };
    f.getRequestData = function(b, c, d) {
        return {
            nodeId: b,
            page: c,
            pageSize: d,
            omitItems: f.hasCachedItemData(b, c, d),
            omitFolders: f.hasCachedFolderData(b)
        }
    };
    f.cacheData = function(b, c, d, a) {
        var e = f.cache[c] || {};
        e.description = b.Description;
        e.parentId = b.ParentId;
        e.title = b.Title;
        if (b.Folders != null) {
            e.folders = [];
            for (var g = b.Folders.length, k = 0; k < g; k++) {
                var l = b.Folders[k];
                e.folders.push({
                    id: l.Id,
                    title: l.Title,
                    description: l.Description,
                    cssClass: l.CssClass,
                    isFolder: l.IsFolder,
                    selectedByDefault: l.SelectedByDefault
                })
            }
        }
        if (b.Items != null) {
            g = [];
            var o = b.Items.length;
            for (k = 0; k < o; k++) {
                l = b.Items[k];
                g.push({
                    id: l.Id,
                    title: l.Title,
                    description: l.Description,
                    cssClass: l.CssClass,
                    isFolder: l.IsFolder,
                    selectable: l.Selectable,
                    selectedByDefault: l.SelectedByDefault
                })
            }
            e.items =
                e.items || {};
            if (a !== e.items.pageSize) e.items = {};
            e.items.pageSize = a;
            e.items.pages = e.items.pages || {};
            e.items.pages[d.toString()] = g;
            e.virtualItemCount = b.VirtualItemCount
        }
        f.cache[c] = e
    };
    f.renderTypeCell = function(b) {
        return "<div class='" + b.cssClass + "'></div>"
    };
    f.renderItemCell = function(b) {
        var c = "<span class='" + b.cssClass + "'>" + CommonFunctions.htmlEncode(b.title) + "</span>",
            d = "";
        if (b.description && b.description !== undefined) d = "<div class='" + j.cssClasses.itemDescription + "'>" + CommonFunctions.htmlEncode(b.description) +
            "</div>";
        return !b.isFolder ? c + d : "<a href='#' class='" + j.cssClasses.folderLink + "' folderId='" + b.id + "'>" + c + "</a>" + d
    };
    f.getItemXML = function(b) {
        var c = [];
        c.push("<Item>");
        c.push("<Id>" + b.id + "</Id>");
        c.push("<Item>" + CommonFunctions.htmlEncode(f.renderItemCell(b)) + "</Item>");
        c.push("<Selectable>" + (b.selectable === true ? "true" : "false") + "</Selectable>");
        c.push("</Item>");
        return c.join("")
    };
    f.renderGrid = function(b, c, d) {
        b = f.cache[b];
        f.controls.grid.pageNumber = c;
        f.controls.grid.pageSize = d;
        d = f.gridContainer.find("." +
            j.cssClasses.gridHeader + " > h2");
        var a = f.gridContainer.find("." + j.cssClasses.gridHeader + " > span");
        d.text(b.title);
        a.text(b.description);
        f.parentId = b.parentId;
        d = f.gridContainer.find("." + j.cssClasses.navigateUpLink);
        f.parentId === "" ? d.addClass(j.cssClasses.disabled) : d.removeClass(j.cssClasses.disabled);
        f.controls.grid.clearSelection();
        f.gridContainer.find("." + j.cssClasses.selectButton).parent("li").addClass(j.cssClasses.disabled);
        d = b.items.pages[c].length;
        a = [];
        a.push("<Data>");
        a.push("<Items>");
        for (var e =
            0; e < d; e++) a.push(f.getItemXML(b.items.pages[c][e]));
        a.push("</Items>");
        a.push("<VirtualCount>" + b.virtualItemCount + "</VirtualCount>");
        a.push("</Data>");
        f.controls.grid.render(a.join(""), false);
        $(f).trigger(j.eventNames.gridRender, [f.controls.grid, b])
    };
    f.showSelectFeedback = function() {
        f.insertFeedbackClientId != "undefined" && window[f.insertFeedbackClientId].show()
    };
    f.hideSelectFeedback = function() {
        f.insertFeedbackClientId != "undefined" && window[f.insertFeedbackClientId].hide()
    };
    f.navigateUpButtonDisable =
        function() {
            var b = $("a." + j.cssClasses.navigateUpLink).parent();
            if (b) b.toggleClass(j.cssClasses.disabled, f.selectedId == f.rootId || !f.parentId && !f.selectedId)
        };
    var h = function(b) {
        var c = [];
        if (b) {
            b.attr("nodeid") != null && c.push([b.attr("nodeid"), b.children("a:first").contents().last().text()]);
            b.parentsUntil("." + j.cssClasses.treeContainer, "li").each(function() {
                var a = $(this);
                c.push([a.attr("nodeid"), a.children("a:first").contents().last().text()])
            })
        }
        f.hideRootCrumb || c.push([f.rootId, f.rootTitle]);
        var d = $("<ul />").addClass(j.cssClasses.crumbs);
        b = $("<nav />").addClass(j.cssClasses.crumbsWrapper).append(d);
        $.each(c, function(a, e) {
            var g = $("<li />").append($("<span />").addClass(j.cssClasses.crumbsSeparator).text(j.breadCrumbsSeparator));
            a > 0 ? g.append($("<span />").append($("<a />").addClass(j.cssClasses.crumb).attr("href", "#").data("node-id", e[0]).text(e[1]))) : g.append($("<span />").text(e[1]));
            g.prependTo(d)
        });
        f.navigation.children("." + j.cssClasses.crumbsWrapper).remove().end().append(b)
    };
    f.navigation.on("click", "a." + j.cssClasses.leftMenuToggler,
        function() {
            $(window).width() > 768 ? f.dialogContainer.toggleClass(j.cssClasses.desktopTreeContainerVisible).toggleClass(j.cssClasses.desktopTreeContainerHidden) : f.dialogContainer.toggleClass(j.cssClasses.mobileTreeContainerVisible).toggleClass(j.cssClasses.mobileTreeContainerHidden);
            return false
        });
    f.navigation.on("click", "." + j.cssClasses.crumb, function() {
        f.navigateToNode($(this).data("node-id"));
        return false
    });
    return f
}

function CclGridColumn(j, f, h, b, c, d, a, e) {
    this.dataField = j;
    this.sortField = f;
    this.sortDescendingByDefault = c;
    this.headerHtml = h;
    this.width = b;
    this.title = d;
    this.className = a;
    this.renderTableDataCellValueInsideDiv = e
}

function CclAjaxGrid(j) {
    function f(b) {
        return b.replace(/^\s+|\s+$/, "")
    }
    window[j] = this;
    var h = this;
    h.name = j;
    h.pageSize = null;
    h.pageNumber = null;
    h.mainColumn = null;
    h.sortingProperty = null;
    h.filteringPreference = null;
    h.sortingDirection = null;
    h.dataSourceWebMethodUrl = null;
    h.dataSourceWebMethodParams = {};
    h.gridClientID = null;
    h.columnChooserDialogName = null;
    h.columnChooserClientID = null;
    h.pagerInstanceName = null;
    h.allowSelecting = false;
    h.allowColumnChoosing = true;
    h.dataKeyName = null;
    h.selectingHiddenClientID = null;
    h.pageNumberHiddenClientID =
        null;
    h.pageSizeHiddenClientID = null;
    h.sortingHiddenClientID = null;
    h.filteringHiddenClientID = null;
    h.columnOrderHiddenClientID = null;
    h.gridContentHiddenClientID = null;
    h.preferenceCategoryName = null;
    h.visibleColumns = [];
    h.columns = [];
    h.totalCount = 0;
    h.keepSelection = true;
    h.allowRowExpanding = true;
    h.expandedRowButtonTitle = null;
    h.emptyTableText = null;
    h.accordionDataSourceUrl = null;
    h.saveToPreferencesWebMethodUrl = null;
    h.gridEmbeddedInAccordionGridControlClientId = null;
    h.cclGridConstants = null;
    h._getColumnsCount = function() {
        return h.visibleColumns.length +
            (h.allowColumnChoosing ? 1 : 0) + (h.allowSelecting ? 1 : 0)
    };
    h._saveToPreferences = function(b, c, d, a) {
        h.saveToPreferencesWebMethodUrl && $.ajax({
            type: "POST",
            url: h.saveToPreferencesWebMethodUrl,
            data: {
                category: b,
                name: c,
                value: d
            },
            success: a,
            error: null
        })
    };
    h._getInvisibleColumns = function() {
        for (var b = [], c = 0; c < h.columns.length; c++) h.visibleColumns.contains(h.columns[c].dataField) || b.push(h.columns[c].dataField);
        return b
    };
    h._applySelectedRowClass = function(b, c) {
        if (c) {
            var d = h.cclGridConstants.cssClasses.selectedRow;
            b.className =
                f(b.className.replace(d, ""));
            b.className = f(b.className + " " + d)
        } else b.className = f(b.className.replace(h.cclGridConstants.cssClasses.selectedRow, ""))
    };
    h._addRemoveSelectedValue = function(b, c) {
        c ? CommonFunctions.addIdToHidden(h.selectingHiddenClientID, b) : CommonFunctions.removeIdFromHidden(h.selectingHiddenClientID, b)
    };
    h.toggleSelect = function(b) {
        b != null && h._applySelectedRowClass(b.parentNode.parentNode, b.checked);
        var c = true,
            d = $("#" + h.gridClientID);
        d.find("tr td." + h.cclGridConstants.cssClasses.selectColumn +
            " input:checkbox").each(function(a, e) {
            e.checked || (c &= false);
            b != null && h._addRemoveSelectedValue(e.value, e.checked)
        });
        d.find("tr th." + h.cclGridConstants.cssClasses.selectColumn + " input:checkbox").prop("checked", c)
    };
    h.toggleSelectById = function(b, c) {
        var d = $("#" + h.gridClientID).find("tr td." + h.cclGridConstants.cssClasses.selectColumn + " input:checkbox[value='" + b + "']");
        if (d[0] != null) {
            d.prop("checked", true);
            c && d.prop("disabled", true);
            d[0].parentNode && d[0].parentNode.parentNode && h._applySelectedRowClass(d[0].parentNode.parentNode,
                d[0].checked)
        }
    };
    h.toggleSelectAll = function(b) {
        var c = $("#" + h.gridClientID);
        c.find("tr td." + h.cclGridConstants.cssClasses.selectColumn + " input:checkbox:enabled").each(function(d, a) {
            a.checked = b;
            h._applySelectedRowClass(a.parentNode.parentNode, b);
            h._addRemoveSelectedValue(a.value, a.checked)
        });
        c.find("tr th." + h.cclGridConstants.cssClasses.selectColumn + " input:checkbox:enabled").prop("checked", b)
    };
    h.toggleEnableAll = function(b) {
        var c = $("#" + h.gridClientID);
        c.find("tr td." + h.cclGridConstants.cssClasses.selectColumn +
            " input:checkbox").prop("disabled", !b);
        c.find("tr th." + h.cclGridConstants.cssClasses.selectColumn + " input:checkbox").prop("disabled", !b)
    };
    h.restoreState = function() {
        var b = document.getElementById(h.sortingHiddenClientID).value.split(":");
        h.pageSize = parseInt(document.getElementById(h.pageSizeHiddenClientID).value, 10);
        h.pageNumber = parseInt(document.getElementById(h.pageNumberHiddenClientID).value, 10);
        h.sortingProperty = b[0];
        h.sortingDirection = b[1];
        h.filteringPreference = document.getElementById(h.filteringHiddenClientID).value;
        h.visibleColumns = document.getElementById(h.columnOrderHiddenClientID).value.split(",")
    };
    h.saveState = function() {
        document.getElementById(h.sortingHiddenClientID).value = h.sortingProperty + ":" + h.sortingDirection;
        document.getElementById(h.pageSizeHiddenClientID).value = h.pageSize;
        document.getElementById(h.pageNumberHiddenClientID).value = h.pageNumber;
        document.getElementById(h.columnOrderHiddenClientID).value = h.visibleColumns.toString();
        document.getElementById(h.filteringHiddenClientID).value = h.filteringPreference
    };
    h._getParamsStr = function() {
        var b = "",
            c;
        for (c in h.dataSourceWebMethodParams) b += "&" + c + "=" + escape(h.dataSourceWebMethodParams[c]);
        return b
    };
    h.refresh = function() {
        h.saveState();
        if (h.dataSourceWebMethodUrl) {
            var b = "",
                c = "";
            if (h.sortingProperty) {
                b = h.sortingProperty + ":" + h.sortingDirection;
                if (h.columns.findBySortField(h.sortingProperty).dataField != h.mainColumn) b += "," + h.columns.findByDataField(h.mainColumn).sortField + ":asc"
            }
            if (h.filteringPreference) c = h.filteringPreference;
            if (h.gridEmbeddedInAccordionGridControlClientId.length >
                0 && h.getSelectedValues().length > 0 && document.getElementById(h.gridContentHiddenClientID).value.length > 0) h.render(document.getElementById(h.gridContentHiddenClientID).value, false);
            else {
                if (h.totalCount == 0 && h.gridEmbeddedInAccordionGridControlClientId.length) {
                    var d = $("#" + h.gridClientID + " ." + h.cclGridConstants.cssClasses.emptyTableCell);
                    if ($(d).length < 1) {
                        d = $("#" + h.gridClientID + " > tbody");
                        $(d).empty();
                        $("#" + h.gridClientID + " > tfoot").empty();
                        h._addRowWithText(d, "<img class='" + h.cclGridConstants.cssClasses.gridEmbededInAccordionGridControlLoadingCssClass +
                            "'src='" + h.cclGridConstants.onePixelTransparentImageUrl + "' />", h._getColumnsCount(), h.cclGridConstants.cssClasses.emptyTableCell)
                    }
                }
                $.ajax({
                    type: "POST",
                    url: h.dataSourceWebMethodUrl,
                    data: "pageNumber=" + h.pageNumber + "&pageSize=" + h.pageSize + "&sort=" + b + "&filter=" + c + h._getParamsStr(),
                    dataType: "xml",
                    success: function(a) {
                        if (h.gridEmbeddedInAccordionGridControlClientId.length > 0) document.getElementById(h.gridContentHiddenClientID).value = a.xml ? a.xml : h.XmlToString(a);
                        h.render(a, true)
                    },
                    error: null
                })
            }
        } else h.postbackFunction()
    };
    h.sort = function(b) {
        h.sortingDirection = h.sortingProperty == b ? h.sortingDirection == "asc" ? "desc" : "asc" : h.columns.findBySortField(b).sortDescendingByDefault ? "desc" : "asc";
        h.sortingProperty = b;
        h.goToPage(1);
        b = h.sortingProperty + ":" + h.sortingDirection;
        if (h.columns.findByDataField(h.mainColumn).sortField == h.sortingProperty && h.sortingDirection == "asc") b = null;
        h._saveToPreferences(h.preferenceCategoryName, h.cclGridConstants.preferenceKeys.sorting, b)
    };
    h.filter = function(b) {
        if (h.filteringPreference != b) {
            h.filteringPreference =
                b;
            h.goToPage(1);
            h._saveToPreferences(h.preferenceCategoryName, h.cclGridConstants.preferenceKeys.filtering, b)
        }
    };
    h.goToPage = function(b) {
        if (!h.keepSelection && b != h.pageNumber) document.getElementById(h.selectingHiddenClientID).value = "";
        h.pageNumber = b;
        h.refresh()
    };
    h.changePageSize = function(b) {
        h.pageSize = b;
        h.goToPage(1);
        h._saveToPreferences(h.preferenceCategoryName, h.cclGridConstants.preferenceKeys.pagesize, b)
    };
    h._getPageHref = function(b) {
        return "javascript:" + h.name + ".goToPage(" + b + ");"
    };
    h._addPager = function() {
        var b =
            window[h.pagerInstanceName];
        if (b) {
            b.totalCount = h.totalCount;
            b.pageSize = h.pageSize;
            b.pageNumber = h.pageNumber;
            if (h.hidePagerWhenTotalCountLessMinPageSize && h.totalCount <= b.getMinAvailablePageSize()) $("#" + h.pagerContainerClientId).hide();
            else {
                $("#" + h.pagerContainerClientId).show();
                b.createIn($("#" + h.pagerContainerClientId).empty())
            }
        }
    };
    h._addHeader = function(b) {
        var c = $("<tr></tr>"),
            d;
        if (h.allowSelecting) {
            d = $("<th></th>").attr("scope", "col").attr("class", h.cclGridConstants.cssClasses.selectColumn);
            d.append($("<input type='checkbox'/>").attr("id",
                h.name + "_select").on("click", function() {
                h.toggleSelectAll(this.checked)
            }));
            d.append($("<label class='" + h.cclGridConstants.cssClasses.hiddenLabel + "'</label>").attr("for", h.name + "_select").text(h.cclGridConstants.terms.selectAllRows));
            c.append(d)
        }
        for (var a = 0; a < h.visibleColumns.length; a++) {
            var e = h.columns.findByDataField(h.visibleColumns[a]);
            d = $("<th></th>").attr("scope", "col");
            if (e.sortField) {
                var g = $("<a></a>").attr("href", "#").attr("title", e.title).click({
                        sortField: e.sortField
                    }, function(o) {
                        h.sort(o.data.sortField);
                        return false
                    }),
                    k = $("<span></span>").attr("class", h.cclGridConstants.cssClasses.thText).html(e.headerHtml);
                if (h.sortingProperty == e.sortField) {
                    d.attr("class", h.cclGridConstants.cssClasses.thSelected);
                    var l = h.cclGridConstants.cssClasses.sortingArrow;
                    if (h.sortingDirection != "asc") l += " " + h.cclGridConstants.cssClasses.sortingArrowDesc;
                    g.append($("<img />").attr("class", l).attr("src", h.cclGridConstants.onePixelTransparentImageUrl))
                } else d.attr("class", h.cclGridConstants.cssClasses.thSortable);
                g.append(k);
                d.append(g)
            } else d.html(e.headerHtml);
            e.className && d.addClass(e.className);
            e.width && d.css("width", e.width + "px");
            d.appendTo(c)
        }
        if (h.allowColumnChoosing) {
            d = $("<a class='" + h.cclGridConstants.cssClasses.columnChooserLink + "'></a>").attr("href", "javascript:" + h.name + ".showColumnChooser();").attr("title", h.cclGridConstants.terms.columnChooserToolTip);
            d.append($("<img />").attr("src", h.cclGridConstants.onePixelTransparentImageUrl).attr("alt", h.cclGridConstants.terms.columnChooserToolTip));
            $("<th></th>").attr("class",
                h.cclGridConstants.cssClasses.columnChooserColumn).append(d).appendTo(c)
        }
        b.append(c)
    };
    h.getSelectedValues = function() {
        var b = $("#" + h.selectingHiddenClientID).val();
        if (b.length == 0) return [];
        return b.slice(0, b.length - 1).split(",")
    };
    h.clearSelection = function() {
        $("#" + h.selectingHiddenClientID).val("")
    };
    h.clear = function() {
        h.totalCount = 0;
        h._addHeader($("#" + h.gridClientID + " > thead").empty());
        h._addPager();
        var b = $("#" + h.gridClientID + " > tbody");
        b.empty();
        var c = h._getColumnsCount();
        h._addRowWithText(b, h.emptyTableText,
            c, h.cclGridConstants.cssClasses.emptyTableCell);
        h._addEmptyRows(b, h.cclGridConstants.minRowCount - 1, c);
        $("tr:nth-child(even)", b).addClass(h.cclGridConstants.cssClasses.alternateRow)
    };
    h.render = function(b, c) {
        c || (b = h.StringToXml(b));
        h.totalCount = $("VirtualCount", b).last().text();
        var d = h.getSelectedValues();
        h._addHeader($("#" + h.gridClientID + " > thead").empty());
        h._addPager();
        var a = $("#" + h.gridClientID + " > tbody");
        a.empty();
        var e = $(":first-child > Items > *", b),
            g = e.length > 0;
        if (e.length < 1 && $(b).text() !=
            "") e = $(b).children().children();
        if (h.totalCount < 1) {
            e.length = 0;
            g = false
        }
        e.each(function(l, o) {
            var n = $("<tr></tr>"),
                m = $(h.dataKeyName, o).text(),
                p = $(h.cclGridConstants.rowTooltipTextProperty, o);
            p.length > 0 && n.attr("title", p.text());
            if (h.allowRowExpanding) {
                n.css("cursor", "pointer");
                n.on("click", function(ca) {
                    h.expandCollapseRow(o, ca, m);
                    return true
                })
            }
            if (h.allowSelecting) {
                p = d.contains(m);
                g &= p;
                var r = $("<td></td>").attr("class", h.cclGridConstants.cssClasses.selectColumn);
                if (h.dataKeySelectionVisible.length ==
                    0 || $(h.dataKeySelectionVisible, o).text() === "true") r.append($("<input type='checkbox'/>").attr("id", h.name + "_select_" + m).attr("value", m).prop("checked", p).prop("defaultChecked", p).on("click", function() {
                    h.toggleSelect(this)
                })).append($("<label class='" + h.cclGridConstants.cssClasses.hiddenLabel + "'</label>").attr("for", h.name + "_select_" + m).text(h.cclGridConstants.terms.selectOneRow + " " + $(h.mainColumn, this).text()));
                n.append(r);
                p && n.addClass(h.cclGridConstants.cssClasses.selectedRow)
            }
            for (i = 0; i < h.visibleColumns.length; i++) {
                p =
                    h.columns.findByDataField(h.visibleColumns[i]);
                r = $(h.visibleColumns[i], o);
                var B = $("<td></td>");
                B.html(p.renderTableDataCellValueInsideDiv ? "<div title='" + r.text() + "'>" + r.text() + "</div>" : r.text());
                p.className && B.addClass(p.className);
                B.appendTo(n)
            }
            h.allowColumnChoosing && n.append($("<td></td>"));
            a.append(n)
        });
        h.allowSelecting && $("thead tr th." + h.cclGridConstants.cssClasses.selectColumn + " input:checkbox").prop("checked", g);
        var k = h._getColumnsCount();
        e.length == 0 && h._addRowWithText(a, h.emptyTableText, k,
            h.cclGridConstants.cssClasses.emptyTableCell);
        e.length < h.cclGridConstants.minRowCount && h._addEmptyRows(a, h.cclGridConstants.minRowCount - Math.max(e.length, 1), k);
        $("tr:nth-child(even)", a).addClass(h.cclGridConstants.cssClasses.alternateRow)
    };
    h._addRowWithText = function(b, c, d, a) {
        b.append($("<tr></tr>").append($("<td></td>").attr("class", a).attr("colSpan", d).html(c)))
    };
    h._addEmptyRows = function(b, c, d) {
        for (var a = 0; a < c; a++) h._addRowWithText(b, "&nbsp;", d, "")
    };
    h.createColumnChooser = function(b) {
        h.columnChooserClientID &&
            $("#" + h.columnChooserClientID).sortable({
                opacity: 0.8,
                placeholder: b,
                tolerance: "pointer"
            })
    };
    h.showColumnChooser = function() {
        $("#" + h.columnChooserClientID).empty();
        for (var b = h.visibleColumns.concat(h._getInvisibleColumns()), c = 0; c < b.length; c++) {
            var d = h.columns.findByDataField(b[c]),
                a = h.visibleColumns.contains(d.dataField);
            d = $("<li />").attr("class", h.cclGridConstants.cssClasses.columnChooser).append($("<input type='checkbox'/>").val(d.dataField).attr("id", h.name + "_" + d.dataField + "_chk").prop("checked",
                a).prop("defaultChecked", a)).append($("<label></label>").attr("for", h.name + "_" + d.dataField + "_chk").html(d.headerHtml));
            $("#" + h.columnChooserClientID).append(d)
        }
        window[h.columnChooserDialogName].open();
        (b = $("#" + this.columnChooserClientID).find("input:not(:disabled):first")) && b.focus()
    };
    h.updateColumnsList = function() {
        var b = [];
        $(":checkbox", "#" + h.columnChooserClientID).each(function(d, a) {
            var e = $(a);
            e.prop("checked") && b.push(e.val())
        });
        b.length == 0 && b.push(h.mainColumn);
        if (!b.isEqual(h.visibleColumns)) {
            h.visibleColumns =
                b;
            h.visibleColumns.contains(h.columns.findBySortField(h.sortingProperty).dataField) ? h.refresh() : h.sort(h.columns.findByDataField(h.visibleColumns[0]).sortField);
            var c = null;
            b.isEqual(h.defaultColumnOrder) || (c = h.visibleColumns.toString());
            h._saveToPreferences(h.preferenceCategoryName, h.cclGridConstants.preferenceKeys.columnOrder, c)
        }
        return true
    };
    h._collapseAll = function() {
        $("#" + h.gridClientID + " > tbody > tr." + h.accordionRow).hide()
    };
    h.expandCollapseRow = function(b, c, d) {
        if (c = c ? c : window.event) {
            c = c.srcElement ||
                c.target;
            if (!(c.tagName == "TD" || c.tagName == "TR")) return
        }
        if ($(b).next().hasClass(h.cclGridConstants.cssClasses.accordionRow)) {
            a = $(b).next();
            if (a.is(":hidden")) {
                h._collapseAll();
                a.show();
                a.removeAttr("style")
            } else a.hide()
        } else {
            h._collapseAll();
            var a = $("<tr class='" + h.cclGridConstants.cssClasses.accordionRow + "'></tr>").hide(),
                e = $("<td></td>").attr("colSpan", h._getColumnsCount());
            c = this.accordionDataSourceUrl.indexOf("?") > 0 ? "&" : "?";
            $.get(h.accordionDataSourceUrl + c + h.accordionDataSourceUrlParameterName +
                "=" + encodeURIComponent(d), {}, function(g) {
                    e.html(g);
                    a.show();
                    a.removeAttr("style")
                }, "html");
            a.append(e);
            $(b).after(a)
        }
    };
    h.getRow = function(b) {
        return $("#" + h.gridClientID + " > tbody").find("tr:has(td:first input[value='" + b + "']:checkbox)")
    };
    Array.prototype.findByDataField = function(b) {
        for (x in this)
            if (this[x].dataField == b) return this[x];
        return null
    };
    Array.prototype.findBySortField = function(b) {
        for (x in this)
            if (this[x].sortField == b) return this[x];
        return null
    };
    Array.prototype.isEqual = function(b) {
        if (this.length !=
            b.length) return false;
        for (var c = 0; c < b.length; c++) {
            if (this[c].compare)
                if (!this[c].compare(b[c])) return false;
            if (this[c] !== b[c]) return false
        }
        return true
    };
    Array.prototype.contains = function(b) {
        for (x in this)
            if (this[x] == b) return true;
        return false
    };
    h.StringToXml = function(b) {
        var c;
        if (window.ActiveXObject) {
            c = new ActiveXObject("Microsoft.XMLDOM");
            c.async = "false";
            c.loadXML(b)
        } else c = (new DOMParser).parseFromString(b, "text/xml");
        return c
    };
    h.XmlToString = function(b) {
        return window.ActiveXObject ? b.xml : (new XMLSerializer).serializeToString(b)
    }
}

function CclGridSearchFilterInstance(j) {
    window[j] = this;
    var f = this;
    this.inputEmptyCssClass = null;
    f.firstLoad = function() {
        f.isEmpty = f.settings.isEmpty;
        f.controls.searchInput.focus(function() {
            f.onFocus()
        }).keyup(function(h) {
            return f.onKeyUp(h)
        }).keydown(function(h) {
            h.which === CommonConstants.keyCodes.enter && h.stopPropagation()
        }).keypress(function(h) {
            return h.which !== CommonConstants.keyCodes.enter
        }).blur(function() {
            f.onBlur()
        });
        f.refresh()
    };
    f.onFocus = function() {
        if (f.isEmpty) {
            f.isEmpty = false;
            f.refresh(true)
        }
    };
    f.onBlur = function() {
        if (f.controls.searchInput.val().length == 0) {
            f.isEmpty = true;
            f.refresh();
            f.filter("")
        } else {
            var h = f.settings.preferenceWithoutValue + f.controls.searchInput.val();
            f.filter(h)
        }
    };
    f.onKeyUp = function(h) {
        if (f.isEmpty) {
            f.isEmpty = false;
            f.refresh(true);
            return true
        } else if (h.which === CommonConstants.keyCodes.enter) {
            h = f.settings.preferenceWithoutValue + f.controls.searchInput.val();
            f.filter(h);
            return false
        }
    };
    f.defineState = function() {
        if (!f.isEmpty && f.controls.searchInput.val().length == 0) f.isEmpty =
            true
    };
    f.refresh = function(h) {
        if (f.isEmpty) {
            f.controls.searchInput.addClass(f.inputEmptyCssClass);
            f.controls.searchInput.val(f.settings.searchText)
        } else {
            h && f.controls.searchInput.val("");
            f.controls.searchInput.removeClass(f.inputEmptyCssClass)
        }
    }
}

function HtmlItemPicker(j) {
        function f() {
            return g.is(":visible")
        }

        function h(n) {
            $(g).find("li[data-id='" + n + "']").addClass("ccl-htmlitempicker-highlighteditem ")
        }

        function b(n) {
            $(g).find("li[data-id='" + n + "']").removeClass("ccl-htmlitempicker-highlighteditem ")
        }

        function c(n, m) {
            var p;
            b(n.id);
            p = e.settings.items[m];
            h(p.id);
            o = p
        }

        function d() {
            g = $("<span></span>").attr("id", j + "_menu").addClass(e.settings.cssClasses.menu).insertAfter(k).hide();
            var n = $("<ul></ul>").appendTo(g);
            e.settings.centerAlignment && n.addClass(e.settings.cssClasses.centerAlignment);
            $.each(e.settings.items, function(m, p) {
                n.append($("<li></li>").attr("data-id", p.id.toString()).append($("<a></a>").attr("href", "#").html(p.innerHtml).click(function(r) {
                    a();
                    if (e.controls.selectedValueHidden.val() !== p.id.toString()) {
                        var B = p.innerHtml;
                        e.controls.selectedValueHidden.val(p.id);
                        e.setSelectedHtmlContainer(B);
                        e.onValueChangedFunction(p)
                    }
                    r.preventDefault()
                })))
            })
        }

        function a() {
            g.hide();
            b(o.id)
        }
        window[j] = this;
        var e = this,
            g, k, l, o;
        e.initialize = function() {
            k = e.controls.container;
            l = k.find("> span");
            k.find("> a");
            d();
            l.width(e.settings.width);
            $(document).click(function(n) {
                if (n.target === k[0] || $(n.target).closest(k).length === 1) {
                    if (g.is(":visible")) a();
                    else {
                        n = k.position();
                        g.css({
                            top: n.top + k.height() - 1 + "px",
                            left: n.left + "px",
                            "z-index": e.settings.zIndex,
                            width: k.width()
                        }).show()
                    } if (f()) {
                        o = e.getSelectedItem();
                        h(o.id)
                    }
                } else if (f()) {
                    var m = g.offset();
                    n.clientX > m.left && n.clientX < m.left + g.width() && n.clientY > m.top && n.clientY < m.top + g.height() || a()
                }
            });
            $(document).keydown(function(n) {
                if (f()) switch (n.which) {
                    case 13:
                        if (e.controls.selectedValueHidden.val() !==
                            o.id.toString()) {
                            var m = o.innerHtml;
                            e.controls.selectedValueHidden.val(o.id);
                            e.setSelectedHtmlContainer(m);
                            e.onValueChangedFunction(o)
                        }
                        a();
                        n.preventDefault();
                        return false;
                    case 27:
                        a();
                        break;
                    case 38:
                        if (f()) {
                            m = e.settings.items.indexOf(o);
                            m = m == 0 ? e.settings.items.length - 1 : m - 1;
                            c(o, m)
                        }
                        n.preventDefault();
                        return false;
                    case 40:
                        if (f()) {
                            m = e.settings.items.indexOf(o);
                            m = m == e.settings.items.length - 1 ? 0 : m + 1;
                            c(o, m)
                        }
                        n.preventDefault();
                        return false
                }
            })
        };
        e.getMenu = function() {
            return g
        };
        e.getSelectedItem = function() {
            var n =
                e.settings.items[0];
            $.each(e.settings.items, function(m, p) {
                if (e.controls.selectedValueHidden.val() == p.id.toString()) n = p
            });
            return n
        };
        e.setSelectedHtmlContainer = function(n) {
            l.html("\n" + n + "\n")
        };
        e.setMenuItemContent = function(n, m) {
            $(g.find("a")[n]).html(m);
            e.settings.items[n].innerHtml = m
        };
        return e
    }
    (function(j, f) {
        j(document).on("click", "div[data-hybrid-editor-settings]>div.ccl-hybrideditoritem-text-container, div[data-hybrid-editor-settings]>a.ccl-hybrideditoritem-edit-icon-inline, div[data-hybrid-editor-settings]>a.ccl-hybrideditoritem-edit-icon", null, function(h) {
            var b = j(h.currentTarget).parent("div.ccl-hybrideditoritem");
            b.hybridEditorItem();
            b.hybridEditorItem("edit", h.currentTarget, h.target)
        });
        j(document).on("keydown", "div[data-hybrid-editor-settings]>a.ccl-hybrideditoritem-edit-icon-inline, div[data-hybrid-editor-settings]>a.ccl-hybrideditoritem-edit-icon",
            null, function(h) {
                if (h.which === CommonConstants.keyCodes.enter) {
                    h.preventDefault();
                    setTimeout(function() {
                        h.target.click()
                    }, 400)
                }
            });
        j(document).on("mouseenter mouseleave focus", "div[data-hybrid-editor-settings]>a.ccl-hybrideditoritem-edit-icon-inline, div[data-hybrid-editor-settings]>a.ccl-hybrideditoritem-edit-icon", null, function(h) {
            j(h.currentTarget).siblings("div.ccl-hybrideditoritem-text-container:first").toggleClass("ccl-hybrideditoritem-text-container-hovered", h.type == "mouseenter" || h.type == "focusin")
        });
        j.widget("ccl.hybridEditor", {
            options: {
                editorClientId: f,
                editorSetContentFuncName: f,
                editorGetContentFuncName: f,
                dialogClientId: f,
                saveButtonClientId: f,
                modalDialogCloseHref: f,
                textUpdateCompleted: j.noop,
                ckePopupFixClass: f,
                isIos: false
            },
            _create: function() {
                j("#" + this.options.saveButtonClientId).on("click", j.proxy(this._handleSaveClick, this));
                if (this.options.isIos) {
                    var h = this,
                        b = j("html");
                    j(document).on("cssmodal:show", function(c, d, a) {
                        a == h.options.dialogClientId && b.addClass(h.options.ckePopupFixClass)
                    }).on("cssmodal:hide",
                        function(c, d, a) {
                            a == h.options.dialogClientId && b.removeClass(h.options.ckePopupFixClass)
                        })
                }
            },
            _handleSaveClick: function(h) {
                var b = "";
                if (this.options.editorClientId && this.options.editorGetContentFuncName) b = this.options.editorGetContentFuncName(this.options.editorClientId);
                this._trigger("textUpdateCompleted", h, b);
                this._closeDialog();
                return false
            },
            _closeDialog: function() {
                window.location.href = this.options.modalDialogCloseHref
            },
            openEditor: function(h, b) {
                this.updateEditorText(h);
                b && b != "" && window[this.options.dialogClientId].setTitle(b);
                window.location.href = "#" + this.options.dialogClientId
            },
            updateEditorText: function(h) {
                if (this.options.editorClientId && this.options.editorSetContentFuncName) {
                    this.options.editorSetContentFuncName(h, this.options.editorClientId);
                    window[this.options.dialogClientId].adjustWindowSize()
                }
            }
        })
    })(jQuery);
(function(j, f) {
    j.widget("ccl.hybridEditorItem", {
        options: {
            groupSettingsFunctionName: f,
            groupSettingsFunctionParam: f,
            textContainerId: f,
            editLinkId: f,
            hybridEditorClientId: f,
            editModeEnabled: "hybrid",
            webMethodParams: f,
            saveContentWebUrl: f,
            inlineEditorOptions: f,
            editorDialogTitle: "",
            editToolTipText: f,
            textContainerWatermark: f,
            textContainerWatermarkCssClass: f,
            watermarkDataAttributeName: f
        },
        widgetState: {
            idle: 0,
            inlineEditorOpened: 1,
            savingPlainText: 2,
            savingRichContent: 3
        },
        _editor: f,
        _inlineEditor: f,
        _textContainer: f,
        _editLink: f,
        _isAjaxEnabled: false,
        _isWatermarkUsed: false,
        _groupSettingsAreUsed: false,
        _currentState: f,
        _create: function() {
            this._initializeSettings();
            this.options.webMethodParams = !this._groupSettingsAreUsed ? JSON.parse(this.options.webMethodParams) : this.options.webMethodParams;
            this._isAjaxEnabled = !!this.options.saveContentWebUrl;
            this._textContainer = j("#" + this.options.textContainerId);
            this._textValueHidden = j("#" + this.options.textValueHiddenId);
            this._editLink = j("#" + this.options.editLinkId);
            this._isWatermarkUsed =
                this.options.textContainerWatermark != f && this.options.textContainerWatermark != "";
            if ((this.options.editModeEnabled === "hybrid" || this.options.editModeEnabled === "inline") && this.options.inlineEditorOptions) {
                var h = !this._groupSettingsAreUsed ? JSON.parse(this.options.inlineEditorOptions) : this.options.inlineEditorOptions;
                this._inlineEditor = new ClientInlineEditor(this._textContainer, null, this._textValueHidden, h, j.proxy(this._savePlainText, this), j.proxy(this._inlineEditorModeChanged, this), null)
            }
            if (this.options.hybridEditorClientId) this._editor =
                j("#" + this.options.hybridEditorClientId);
            if (!this._editor || this._editor.length == 0) this.options.editModeEnabled = "inline";
            this._currentState = this.widgetState.idle
        },
        edit: function(h, b) {
            if (h === this._textContainer.get(0)) {
                if (b && j(b).closest("a,input,button,textarea").length > 0) return;
                this._handleTextContainerClick()
            }
            h === this._editLink.get(0) && this._handleIconClick()
        },
        updateTextContainer: function(h, b) {
            this._updateText(h, b)
        },
        _initializeSettings: function() {
            var h = this.element.data("hybrid-editor-settings");
            if (j.isFunction(window[h.groupSettingsFunctionName])) {
                var b;
                b = h.groupSettingsFunctionParam ? window[h.groupSettingsFunctionName](h.groupSettingsFunctionParam) : window[h.groupSettingsFunctionName]();
                j.extend(this.options, b);
                this.options.textContainerId = h.textContainerId;
                this.options.textValueHiddenId = h.textValueHiddenId;
                this.options.editLinkId = h.editLinkId;
                this.options.hybridEditorClientId = h.hybridEditorClientId;
                this.options.watermarkDataAttributeName = h.watermarkDataAttributeName;
                j.extend(this.options.inlineEditorOptions, {
                    supressOriginalBehaviour: true,
                    editFieldAutoWidth: false
                });
                this._groupSettingsAreUsed = true
            } else j.extend(this.options, h)
        },
        _handleTextContainerClick: function() {
            if (this._editor) switch (this.options.editModeEnabled) {
                case "dialog":
                    this._openHybridEditor();
                    break;
                case "hybrid":
                    var h = this._textContainer.html();
                    h === "" || this._isWatermarkApplied() || CommonFunctions.isPlainText(h) ? this._openInlineEditor() : this._openHybridEditor();
                    break;
                default:
                    this._openInlineEditor()
            } else this._openInlineEditor()
        },
        _handleIconClick: function() {
            this._editor &&
                (this.options.editModeEnabled === "hybrid" || this.options.editModeEnabled === "dialog") ? this._openHybridEditor() : this._openInlineEditor()
        },
        _openInlineEditor: function() {
            if (!(!this._inlineEditor || this._currentState != this.widgetState.idle)) {
                this._removeWatermark();
                this._inlineEditor.switchToEditMode();
                this._currentState = this.widgetState.inlineEditorOpened
            }
        },
        _openHybridEditor: function() {
            if (!(!this._editor || this._currentState == this.widgetState.savingRichContent)) {
                var h = this._currentState == this.widgetState.inlineEditorOpened ||
                    this._currentState == this.widgetState.savingPlainText,
                    b = j.proxy(this._saveRichContent, this);
                this._editor.off("hybrideditortextupdatecompleted").one("hybrideditortextupdatecompleted", b);
                b = this._textValueHidden.val();
                if (CommonFunctions.isPlainText(b)) b = this._textContainer.html();
                if (h) b = CommonFunctions.replaceLineBreaksWithBrTags(this._inlineEditor.getEditFieldText());
                this._editor.hybridEditor("openEditor", this._isWatermarkApplied() && !h ? "" : b, this.options.editorDialogTitle)
            }
        },
        _savePlainText: function(h,
            b) {
            var c = j.trim(h.actualText);
            if (this._isAjaxEnabled) {
                if (this.options.saveContentWebUrl && this.options.webMethodParams) {
                    var d = this;
                    c = {
                        data: encodeURIComponent(this._processPlainText(c))
                    };
                    c = j.extend(this.options.webMethodParams, c);
                    this._currentState = this.widgetState.savingPlainText;
                    j.ajax({
                        type: "POST",
                        url: this.options.saveContentWebUrl,
                        data: c,
                        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
                        success: function(a) {
                            if (a)
                                if (a.IsSuccessfull) {
                                    h.actualText = a.Value;
                                    d._textUpdated(a.SafeHtml, a.Value)
                                } else {
                                    h.isUpdateSuccess =
                                        false;
                                    h.stopOnEdit = true;
                                    d._handleError(a.ErrorText)
                                }
                        },
                        error: function(a, e, g) {
                            h.isUpdateSuccess = false;
                            h.stopOnEdit = true;
                            d._handleAjaxError(a, e, g)
                        },
                        complete: function() {
                            b(h)
                        }
                    })
                }
            } else {
                this._textUpdated(this._processPlainText(c), c);
                b(h)
            }
        },
        _saveRichContent: function(h, b) {
            if (j.isPlainObject(b)) b = "";
            if (this._isAjaxEnabled) {
                if (this.options.saveContentWebUrl && this.options.webMethodParams) {
                    var c = this,
                        d = {
                            data: encodeURIComponent(b)
                        };
                    d = j.extend(this.options.webMethodParams, d);
                    this._currentState = this.widgetState.savingRichContent;
                    j.ajax({
                        type: "POST",
                        url: this.options.saveContentWebUrl,
                        data: d,
                        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
                        success: function(a) {
                            if (a)
                                if (a.IsSuccessfull) {
                                    c._textUpdated(a.SafeHtml, a.Value);
                                    CommonFunctions.isPlainText(a.SafeHtml) && c._inlineEditor.setNewText(a.Value)
                                } else c._handleError(a.ErrorText);
                            c._addWatermark();
                            c._currentState = c.widgetState.idle
                        },
                        error: function(a, e, g) {
                            c._handleAjaxError(a, e, g)
                        }
                    })
                }
            } else {
                this._textUpdated(b, b);
                this._addWatermark()
            }
        },
        _addWatermark: function() {
            if (!(!this._isWatermarkUsed ||
                this._isWatermarkApplied())) {
                var h = this._textContainer.html();
                if (!h || h == "") {
                    h = j("<span " + this.options.watermarkDataAttributeName + "='true'/>").text(this.options.textContainerWatermark);
                    this.options.textContainerWatermarkCssClass && h.addClass(this.options.textContainerWatermarkCssClass);
                    this._textContainer.prepend(h)
                }
            }
        },
        _removeWatermark: function() {
            if (this._isWatermarkUsed) {
                var h = this._textContainer.find("span[" + this.options.watermarkDataAttributeName + "]");
                h.length > 0 && h.remove()
            }
        },
        _isWatermarkApplied: function() {
            return this._isWatermarkUsed &&
                this._textContainer.find("span[" + this.options.watermarkDataAttributeName + "]").length > 0
        },
        _inlineEditorModeChanged: function(h) {
            if (!h.isEditMode) {
                this._addWatermark();
                this._currentState = this.widgetState.idle
            }
            this._trigger("inlinemodechanged", null, h)
        },
        _textUpdated: function(h, b) {
            this._updateText(h, b);
            this._trigger("textupdated", null, {
                html: h,
                value: b
            })
        },
        _updateText: function(h, b) {
            this._textValueHidden.val(b);
            this._textContainer.html(h)
        },
        _processPlainText: function(h) {
            return h.replace(/&/g, "&amp;").replace(/</g,
                "&lt;").replace(/>/g, "&gt;").replace(/  /g, " &nbsp;")
        },
        _handleAjaxError: function(h) {
            this._trigger("ajaxerror", null, {
                xhrObject: h
            })
        },
        _handleError: function(h) {
            this._trigger("saveerror", null, {
                errorText: h
            })
        }
    })
})(jQuery);
(function(j) {
    var f = $(j.document);
    j.IframeClickEventHelper = {
        registerDocumentClickBubblingOnTop: function() {
            f.on("click touchstart", function() {
                var h;
                if ((h = j.top) != j) CommonFunctions.makePostMessageCall(h, {
                    messageName: "iframeClickBubble"
                })
            })
        },
        handleDocumentClickBubblingOnTop: function() {
            CommonFunctions.attachPostMessageEventListener($(j), "iframeClickBubble", function() {
                f.trigger(CommonTriggers.clickInInnerFrame)
            })
        }
    }
})(window);
(function(j) {
    j.IframeResizer = {
        reportSetIframeDefaultHeight: function() {
            var f;
            if ((f = j.parent) && j != f) CommonFunctions.makePostMessageCall(f, {
                messageName: "setIframeDefaultHeight"
            })
        },
        registerDefaultHeight: function(f, h) {
            var b = $(j),
                c = $("#" + f.iframeClientId),
                d, a, e = IframeResizer.calculateBottomOffset(c);
            a = j[f.setIframeDefaultHeightFunctionName] = function() {
                var g = IframeResizer.getIframeDefaultHeight(b, c, e) - 8;
                c.height(g);
                h && h(g + 8)
            };
            a();
            b.resize(function() {
                d && clearTimeout(d);
                d = setTimeout(a, 200)
            });
            CommonFunctions.attachPostMessageEventListener(b,
                "setIframeDefaultHeight", function() {
                    a()
                })
        },
        getIframeDefaultHeight: function(f, h, b) {
            return f.innerHeight() - h.offset().top - b
        },
        calculateBottomOffset: function(f) {
            function h(c, d) {
                var a = parseInt(c.css(d));
                return isNaN(a) ? 0 : a
            }
            var b = 0;
            f.parentsUntil("html").each(function(c, d) {
                var a = $(d);
                b += h(a, "padding-bottom") + h(a, "margin-bottom") + h(a, "border-bottom-width")
            });
            return b
        },
        registerExtensionIframeListener: function(f) {
            var h = $("#" + f.iframeClientId);
            CommonFunctions.attachPostMessageEventListener($(j), [CommonWindowMessages.expandExtensionIframe.messageName,
                CommonWindowMessages.collapseExtensionIframe.messageName
            ], function(b) {
                var c = (b = b.messageName === CommonWindowMessages.expandExtensionIframe.messageName) ? "0" : "";
                h.css({
                    position: b ? "absolute" : "",
                    top: c,
                    right: c,
                    bottom: c,
                    left: c
                });
                IframeResizer.reportSetIframeDefaultHeight()
            })
        }
    }
})(window);

function InlineFeedback(j) {
        window[j] = this;
        var f = this;
        f.show = function(h) {
            var b = f.controls;
            b.container.css("visibility", "visible");
            h > 0 && b.container.delay(h * 1E3).fadeTo("slow", 0, function() {
                $(this).css("visibility", "hidden").css("opacity", 1)
            })
        }
    }
    (function(j) {
        j.InlineReplyManager = {
            sendButtonClick: function(f, h) {
                var b = $(f),
                    c = b.parent().prev(),
                    d = c.val();
                if (d) {
                    b.prop("disabled", true);
                    h({
                        target: b,
                        messageBody: CommonFunctions.replaceLineBreaksWithBrTags(CommonFunctions.htmlEncode(d)),
                        sendMessageCompleteCallback: function() {
                            b.prop("disabled", false)
                        },
                        sendMessageSuccessCallback: function() {
                            c.val("")
                        }
                    })
                }
            }
        }
    })(window);
(function(j) {
    typeof define === "function" && define.amd ? define(["jquery"], j) : j(jQuery)
})(function(j) {
    if (!(j.support.cors || !j.ajaxTransport || !window.XDomainRequest)) {
        var f = /^https?:\/\//i,
            h = /^get|post$/i,
            b = RegExp("^" + location.protocol, "i");
        j.ajaxTransport("* text html xml json", function(c, d) {
            if (!(!c.crossDomain || !c.async || !h.test(c.type) || !f.test(c.url) || !b.test(c.url))) {
                var a = null;
                return {
                    send: function(e, g) {
                        var k = "",
                            l = (d.dataType || "").toLowerCase();
                        a = new XDomainRequest;
                        if (/^\d+$/.test(d.timeout)) a.timeout =
                            d.timeout;
                        a.ontimeout = function() {
                            g(500, "timeout")
                        };
                        a.onload = function() {
                            var o = "Content-Length: " + a.responseText.length + "\r\nContent-Type: " + a.contentType,
                                n = {
                                    code: 200,
                                    message: "success"
                                },
                                m = {
                                    text: a.responseText
                                };
                            try {
                                if (l === "html" || /text\/html/i.test(a.contentType)) m.html = a.responseText;
                                else if (l === "json" || l !== "text" && /\/json/i.test(a.contentType)) try {
                                    m.json = j.parseJSON(a.responseText)
                                } catch (p) {
                                    n.code = 500;
                                    n.message = "parseerror"
                                } else if (l === "xml" || l !== "text" && /\/xml/i.test(a.contentType)) {
                                    var r = new ActiveXObject("Microsoft.XMLDOM");
                                    r.async = false;
                                    try {
                                        r.loadXML(a.responseText)
                                    } catch (B) {
                                        r = undefined
                                    }
                                    if (!r || !r.documentElement || r.getElementsByTagName("parsererror").length) {
                                        n.code = 500;
                                        n.message = "parseerror";
                                        throw "Invalid XML: " + a.responseText;
                                    }
                                    m.xml = r
                                }
                            } catch (ca) {
                                throw ca;
                            } finally {
                                g(n.code, n.message, m, o)
                            }
                        };
                        a.onprogress = function() {};
                        a.onerror = function() {
                            g(500, "error", {
                                text: a.responseText
                            })
                        };
                        if (d.data) k = j.type(d.data) === "string" ? d.data : j.param(d.data);
                        a.open(c.type, c.url);
                        a.send(k)
                    },
                    abort: function() {
                        a && a.abort()
                    }
                }
            }
        })
    }
});

function KeepAlive() {
    function j() {
        h && h.webMethodUrl && $.ajax({
            type: "POST",
            data: h.postData,
            url: h.webMethodUrl,
            contentType: "application/json; charset=utf-8",
            success: function() {
                b = 0;
                setTimeout(function() {
                    j()
                }, h.intervalInSeconds * 1E3)
            },
            error: function() {
                b++;
                b < h.maxNumberOfTries && setTimeout(function() {
                    j()
                }, h.errorTimeoutInSeconds * 1E3)
            }
        })
    }
    var f = this,
        h, b = 0;
    f.initialize = function() {
        (h = f.settings) && setTimeout(function() {
            j()
        }, h.intervalInSeconds * 1E3)
    };
    return f
}

function LabeledInput(j) {
    function f() {
        return k.find("." + c.settings.itemClass)
    }

    function h(l, o) {
        c.pushLabel(o.item.label, o.item.metadata);
        a.val("");
        return false
    }

    function b() {
        g.each(function(l) {
            l()
        })
    }
    var c = this,
        d, a, e, g = [],
        k;
    window[j] = c;
    c.initialize = function() {
        c.settings.onLabelsChangedHandler && g.push(c.settings.onLabelsChangedHandler);
        d = c.settings.removeButtonTooltipFormat;
        k = $("#" + c.settings.containerId);
        k.on(c.settings.clickOrTouch, ".ccl-labeled-input-remove", function(l) {
            $(l.target).parent().remove();
            b()
        });
        a = $("#" + c.settings.inputId);
        e = a.parent();
        a.autocomplete({
            position: {
                collision: "fit"
            },
            source: c.settings.autocompleteCallback,
            select: h,
            delay: c.settings.autocomplete.delay,
            minLength: c.settings.autocomplete.minLength,
            messages: {
                noResults: "",
                results: function() {}
            },
            create: function() {
                if (c.settings.renderItem) $(this).data("ui-autocomplete")._renderItem = c.settings.renderItem
            }
        });
        a.on("keydown", function(l) {
            if (l.which === CommonConstants.keyCodes.backspace && !c.hasText()) {
                l = f();
                if (l.length > 0) {
                    l.last().remove();
                    b()
                }
            }
        });
        c.settings.autocomplete.autocompleteMenuCssClass && a.data("ui-autocomplete").menu.activeMenu.addClass(c.settings.autocomplete.autocompleteMenuCssClass);
        e.append(a.data("autocomplete").menu.activeMenu.detach());
        k.on(c.settings.clickOrTouch, function(l) {
            if (!a.is(":focus")) {
                l.preventDefault();
                a.focus()
            }
        })
    };
    c.pushLabel = function(l, o) {
        var n = $("<span></span>"),
            m = $("<span>" + l + "</span>"),
            p = $('<a href="#" class="ccl-labeled-input-remove">x</a>');
        p.prop("title", d.replace("{0}", l));
        n.data("meta", o);
        m.addClass(c.settings.textClass);
        n.addClass(c.settings.itemClass);
        n.append(m).append(p);
        n.insertBefore(e);
        b()
    };
    c.getLabels = function() {
        return $.makeArray(f().map(function(l, o) {
            return $(o).data("meta")
        }))
    };
    c.mapLabelsField = function(l) {
        return c.getLabels().map(function(o) {
            return o[l]
        })
    };
    c.clear = function() {
        f().remove();
        a.val("")
    };
    c.hasText = function() {
        return a.val().trim() !== ""
    };
    c.getText = function() {
        return a.val()
    };
    c.addLabelsChangedHandler = function(l) {
        g.push(l)
    };
    c.focus = function() {
        a.focus()
    }
}

function LearningObjectivesSelector(j, f, h, b, c, d) {
    window[j] = this;
    var a = this;
    a.readLearningObjectivesUrl = c.readLearningObjectivesUrl;
    a.selectedIds = b;
    a.selectableCategory = c.selectableCategory;
    a.selectableObjective = c.selectableObjective;
    a.selectableSubject = c.selectableSubject;
    a.terms = h;
    a.language = c.language;
    a.updateContainerOnSelect = c.updateContainerOnSelect;
    if (f) {
        a.folderSelector = f;
        a.baseGetRequestData = f.getRequestData;
        a.editable = true
    } else a.editable = false;
    a.placeHolderOnEmpty = c.placeHolderOnEmpty;
    a.courseId =
        c.courseId;
    a.countryCode = c.countryCode;
    a.showTooltip = c.showTooltip;
    a.firstLoad = true;
    a.cache = {};
    a.cssClasses = d;
    a.filtersData = {};
    if (c.filtersData != "") a.filtersData = c.filtersData;
    a.defaultFilter = c.defaultFilter;
    a.filtersddl = $(".js-filter-ddl");
    a.GetCurrentFilter = function() {
        if (a.filtersddl.length > 0) return a.filtersddl.find(":selected").val();
        return a.defaultFilter
    };
    if (a.folderSelector) {
        a.folderSelector.dialogContainer.addClass(a.cssClasses.learningObjectivesSelector);
        a.folderSelector.showFeedbackOnEmpty =
            a.filtersddl.length == 0
    }
    a.selectedContainer = $("#" + j).find("." + a.cssClasses.selectedContainer);
    a.emptyContainer = $("#" + j).find("." + a.cssClasses.emptyContainer);
    a.addLink = $("#" + j).find("." + a.cssClasses.addLink);
    a.editable && a.selectedContainer.on("click", "." + a.cssClasses.removeLink, function() {
        a.removeSelectedIds([$(this).attr("loId")]);
        return false
    });
    a.openDialog = function() {
        a.folderSelector && a.folderSelector.openDialog(a.filtersData[a.GetCurrentFilter()])
    };
    a.updateSelectedItemsContainer = function() {
        if (a.updateContainerOnSelect) {
            $(a.selectedContainer).empty();
            $(a.emptyContainer).empty();
            if (a.selectedIds.length == 0) $(a.emptyContainer).text(a.placeHolderOnEmpty);
            else {
                a.setSelectedIds(a.selectedIds, true);
                a.loadData(a.selectedIds, function(g) {
                    var k = [];
                    $.each(g, function(l, o) {
                        var n = $("<div></div>"),
                            m = $("<span></span>");
                        m.addClass(a.cssClasses.selectedItemIcon);
                        m.addClass(o.type);
                        n.append(m);
                        n.append(a.showTooltip ? a.createTooltip(o.title, o.description) : $("<span></span>").text(o.title));
                        if (a.editable) {
                            m = $("<a></a>").addClass(a.cssClasses.removeLink).attr("loId",
                                o.id).attr("title", a.terms.deleteTooltip).attr("href", "#").text("\u00d7");
                            n.append(m)
                        }
                        $(a.selectedContainer).append(n);
                        k.push(o.id)
                    });
                    k.length == 0 && $(a.selectedContainer).text(a.placeHolderOnEmpty)
                })
            }
        }
    };
    a.createTooltip = function(g, k) {
        var l = $("<span></span>");
        l.text(g);
        var o = new ToolTip(null, l);
        o.title = g;
        o.description = k;
        o.settings = {
            showPopupTimeout: 300,
            hidePopupTimeout: 300,
            cssClasses: {
                tooltipPopup: "ccl-tooltip-popup",
                linkToTooltip: "ccl-tooltip-link",
                arrowUp: "ccl-tooltip-arrow-up",
                arrowDown: "ccl-tooltip-arrow-down",
                arrowContainer: "ccl-tooltip-arrow-container",
                tooltipTitle: "ccl-tooltip-popup-title",
                tooltipDescription: "ccl-tooltip-popup-description"
            }
        };
        o.initialize();
        return l
    };
    a.showSelectFeedback = function() {
        a.folderSelector.showSelectFeedback()
    };
    a.addSelectedIds = function(g) {
        var k = {};
        $.each(a.selectedIds, function(l, o) {
            k[o] = o
        });
        $.each(g, function(l, o) {
            k[o] = o
        });
        a.selectedIds = [];
        $.each(k, function(l) {
            a.selectedIds.push(l)
        });
        $(a).trigger("selectionchange");
        a.updateSelectedItemsContainer()
    };
    a.removeSelectedIds = function(g) {
        var k = {};
        $.each(a.selectedIds, function(l, o) {
            k[o] = o
        });
        $.each(g, function(l, o) {
            delete k[o]
        });
        a.selectedIds = [];
        $.each(k, function(l) {
            a.selectedIds.push(l)
        });
        $(a).trigger("selectionchange");
        a.updateSelectedItemsContainer()
    };
    a.clearSelectedIds = function() {
        a.selectedIds = [];
        $(a).trigger("selectionchange");
        a.updateSelectedItemsContainer()
    };
    a.setSelectedIds = function(g, k) {
        a.selectedIds = [];
        a.selectedIds = g;
        if (a.folderSelector) {
            $.each(a.selectedIds, function(l, o) {
                a.folderSelector.controls.grid.toggleSelectById(o, k)
            });
            k &&
                a.folderSelector.enableSelectButton(false)
        }
    };
    a.loadData = function(g, k) {
        var l = [],
            o = {};
        $.each(g, function(n, m) {
            if (a.cache[m] === undefined) l.push(m);
            else o[m] = a.cache[m]
        });
        l.length == 0 ? k(o) : $.ajax({
            type: "POST",
            url: a.readLearningObjectivesUrl,
            data: {
                ids: l.join(",")
            },
            dataType: "jsonp",
            success: function(n) {
                $.each(n.Items, function(m, p) {
                    var r = {
                        id: p.Id,
                        title: p.Title,
                        description: p.Description,
                        type: p.Type
                    };
                    a.cache[p.Id] = r;
                    o[p.Id] = r
                });
                k(o)
            },
            error: function() {
                $(a).trigger("error")
            }
        })
    };
    a.changeFilter = function(g) {
        a.folderSelector.reinitialize(true,
            a.filtersData[g])
    };
    if (f) {
        var e = false;
        f.getRequestData = function(g, k, l) {
            g = a.baseGetRequestData(g, k, l);
            g.SelectableCategory = a.selectableCategory;
            g.SelectableLearningObjective = a.selectableObjective;
            g.SelectableSubject = a.selectableSubject;
            if (a.language) g.lan = a.language;
            return g
        };
        $(f).on(c.folderSelectorEvents.select, function(g, k) {
            a.addSelectedIds(e ? [k.selectedId] : k.nodeIds)
        });
        c.restrictInsertContext ? $(f).on(c.folderSelectorEvents.gridRender, function(g, k, l) {
            if (e = l.virtualItemCount > l.folders.length) {
                k.toggleSelectAll(true);
                k.toggleEnableAll(false)
            }
        }) : $(f).on(c.folderSelectorEvents.gridRender, function(g, k) {
            $.each(a.selectedIds, function(l, o) {
                k.toggleSelectById(o, true)
            })
        });
        a.filtersddl && a.filtersddl.on("change", function() {
            a.changeFilter($(this).val())
        })
    }
    a.updateSelectedItemsContainer();
    return a
}

function MetadataTranslationsList(j) {
    window[j] = this;
    var f = this,
        h;
    f.firstLoad = function() {
        h = f.controls.table.find("tbody");
        var b = f.controls.languageDataHidden.val();
        f.settings.metadataLanguages = b ? JSON.parse(b) : [];
        f.controls.addLanguageLink.on("click", function() {
            f.addLanguageLinkClick()
        });
        f.controls.languageInput.on("change", function() {
            f.controls.languageIdHidden.val(f.controls.languageInput.val())
        });
        f.updateAddButton();
        $.each(f.metadataColumns, function(c, d) {
            if (d.IsMultiLine) {
                var a = f.getInputForMetadataColumn(d),
                    e = a.attr("rows") * a.attr("cols") * 2;
                a.keypress(function(g) {
                    a.val().length > e && g.preventDefault()
                });
                a.on("paste", function() {
                    setTimeout(function() {
                        a.val($.trim(a.val().replace(/[\n\r]+/g, "")));
                        a.val(a.val().substring(0, e))
                    }, 100)
                })
            }
        })
    };
    f.getInputForMetadataColumn = function(b) {
        return $("#" + f.settings.modalDialogClientId + "_" + b.Name)
    };
    f.addLanguageLinkClick = function() {
        f.fillLanguageInfo(null)
    };
    f.editLanguageLinkClick = function(b, c) {
        f.fillLanguageInfo(c)
    };
    f.dialogLoaded = function() {
        f.controls.languageInput.is(":visible") ?
            f.controls.languageInput.focus() : f.getInputForMetadataColumn(f.metadataColumns[0]).focus()
    };
    f.saveLanguageClick = function() {
        f.clearValidators();
        var b = {},
            c = true,
            d = parseInt(f.controls.languageIdHidden.val());
        if (d < 0) {
            f.showValidationMessage(f.controls.languageInput, f.settings.requiredValidationMessage);
            c = false
        }
        b[f.settings.metadataLanguageIdDataField] = d;
        $.each(f.metadataColumns, function(e, g) {
            var k = $.trim(f.getInputForMetadataColumn(g).val());
            f.validateMetadataColumn(g, k) || (c = false);
            b[g.DataField] = k
        });
        if (!c) return false;
        var a = f.findMetadataLanguageById(d);
        a ? $.each(f.metadataColumns, function(e, g) {
            a[g.DataField] = b[g.DataField]
        }) : f.settings.metadataLanguages.push(b);
        f.saveLanguagesToHidden();
        f.fillTableRow(b);
        f.updateTable();
        f.updateAddButton();
        return true
    };
    f.getTableRow = function(b) {
        b = h.find("tr:has(td:first input[value='" + b + "']:hidden)");
        if (b.length == 0) b = $("<tr></tr>").appendTo(h);
        return b
    };
    f.fillTableRow = function(b) {
        var c = f.cssClasses,
            d = b[f.settings.metadataLanguageIdDataField],
            a = f.getTableRow(d);
        a.empty().append($("<td></td>").addClass(c.TableColumnLanguage).append($("<input />").attr("type", "hidden").val(d)).append($("<a></a>").attr("href", "javascript:void(0);").text(f.getLanguageTitleById(d)).on("click", function() {
            f.editLanguageLinkClick(this, d)
        })));
        $.each(f.metadataColumns, function(e, g) {
            a.append($("<td></td>").addClass(g.CssClass).text(b[g.DataField]))
        });
        a.append($("<td></td>").addClass(c.TableColumnDelete).append($("<a></a>").addClass("ccl-iconlink").addClass(c.TableColumnDeleteImage).attr("href",
            "javascript:void(0);").attr("title", f.settings.deleteRowTooltip).on("click", function() {
            f.removeLanguageClick(this, d)
        }).append($("<img />").attr("src", f.settings.deleteImageUrl).attr("alt", f.settings.deleteRowTooltip).addClass(c.tableColumnDeleteImage))))
    };
    f.validateMetadataColumn = function(b, c) {
        var d = true;
        if (b.IsRequired && c.length == 0) {
            d = false;
            f.showValidationMessage(f.getInputForMetadataColumn(b), f.settings.requiredValidationMessage)
        }
        return d
    };
    f.removeLanguageClick = function(b, c) {
        var d = f.settings.metadataLanguages;
        $.each(d, function(a, e) {
            if (e[f.settings.metadataLanguageIdDataField] == c) {
                d.splice(a, 1);
                f.saveLanguagesToHidden();
                return false
            }
            return true
        });
        $(b).parent().parent().remove();
        f.updateTable();
        f.updateAddButton()
    };
    f.saveLanguagesToHidden = function() {
        f.controls.languageDataHidden.val(JSON.stringify(f.settings.metadataLanguages))
    };
    f.findMetadataLanguageById = function(b) {
        var c = null;
        $.each(f.settings.metadataLanguages, function(d, a) {
            if (a[f.settings.metadataLanguageIdDataField] == b) {
                c = a;
                return false
            }
            return true
        });
        return c
    };
    f.getAvailableLanguagesData = function() {
        return $.grep(f.settings.languages, function(b) {
            return f.findMetadataLanguageById(b.Key) == null
        })
    };
    f.disableSelectedLanguages = function() {
        var b = f.controls.languageInput;
        b.find("option").remove();
        $.each(f.getAvailableLanguagesData(), function(c, d) {
            b.append($("<option></option>").val(d.Key).text(d.Value))
        })
    };
    f.getLanguageTitleById = function(b) {
        for (index in f.settings.languages)
            if (f.settings.languages[index].Key == b) return f.settings.languages[index].Value;
        return ""
    };
    f.showValidationMessage = function(b, c) {
        $("<div></div>").text(c).addClass(f.cssClasses.ErrorMessage).appendTo(b.parent())
    };
    f.clearValidators = function() {
        f.controls.modalDialogContainer.find("div." + f.cssClasses.ErrorMessage).remove()
    };
    f.fillLanguageInfo = function(b) {
        var c = null;
        if (b >= 0) c = f.findMetadataLanguageById(b);
        var d = !!c;
        f.clearValidators();
        window[f.settings.modalDialogName].setNewTitle(d ? f.getLanguageTitleById(b) : f.settings.addLanguageDialogTitle);
        f.controls.languageIdHidden.val(d ? c[f.settings.metadataLanguageIdDataField] :
            -1);
        f.controls.languageInput.parent().toggle(!d);
        $.each(f.metadataColumns, function(a, e) {
            f.getInputForMetadataColumn(e).val(d ? c[e.DataField] : "")
        });
        d || f.disableSelectedLanguages();
        window[f.settings.modalDialogName].open()
    };
    f.updateTable = function() {
        var b = f.cssClasses.TableRowAlternate;
        h.find("tr:even").removeClass(b);
        h.find("tr:odd").addClass(b);
        h.parent().toggle(h.find("tr:has(td)").length > 0)
    };
    f.updateAddButton = function() {
        f.controls.addLanguageLink.toggle(f.settings.metadataLanguages.length < f.settings.languages.length -
            1)
    };
    return f
}

function OkOrCancel(j) {
    window[j] = this;
    var f = this,
        h, b;
    f.initialize = function() {
        h = f.scripts;
        b = f.controls;
        f.toggleInProgressState(false);
        b.okButton.click(function() {
            f.toggleInProgressState(true);
            CommonFunctions.safeExecuteFunction(h.okButtonClick)
        })
    };
    f.toggleInProgressState = function(c, d) {
        if (c) {
            b.okButton.addClass(f.settings.inProgressCssClass);
            b.okButton.attr("title", f.settings.inProgressTitle)
        } else {
            b.okButton.removeAttr("title");
            b.okButton.removeClass(f.settings.inProgressCssClass)
        }
        b.okButton.prop("disabled", c);
        d && b.cancelButton.toggleHyperlink(!c)
    };
    return f
}

function Pager(j) {
        window[j] = this;
        var f = this,
            h, b;
        f.totalCount = 0;
        f.pageSize = 0;
        f.pageNumber = 0;
        f.initialize = function() {
            h = f.settings.cssClasses;
            b = f.settings.terms
        };
        f.goToPage = function(c) {
            f.customScripts.goToPage && f.customScripts.goToPage({
                pageNumber: c
            })
        };
        f.changePageSize = function(c) {
            f.customScripts.changePageSize && f.customScripts.changePageSize({
                pageSize: c
            })
        };
        f.hide = function() {
            f.controls.pagerContainer.empty()
        };
        f.getMinAvailablePageSize = function() {
            return f.settings.pageSizes && f.settings.pageSizes.length >
                0 ? f.settings.pageSizes[0] : 0
        };
        f.render = function() {
            var c = f.controls.pagerContainer,
                d = $("<ul></ul>").attr("class", h.pager),
                a = Math.ceil(f.totalCount / f.pageSize),
                e, g, k;
            c.empty();
            c.append(d);
            if (f.mode & f.settings.pagerMode.nextPrev && a > 0) {
                if (f.pageNumber > 1) {
                    k = $("<li></li>").attr("class", h.previousNext);
                    var l = f.pageNumber - 1;
                    g = $("<a></a>").attr("href", "#").attr("title", b.previous).click(function() {
                        f.goToPage(l);
                        return false
                    }).append($("<span></span>").html("&laquo;").attr("class", h.prevArrow));
                    k.append(g)
                } else k =
                    $("<li></li>").attr("class", h.text).append($("<span></span>").html("&laquo;").attr("class", h.prevArrowDisabled)); if (f.pageNumber < a) {
                    var o = f.pageNumber + 1;
                    g = $("<li></li>").attr("class", h.previousNext).append($("<a></a>").attr("href", "#").attr("title", b.next).click(function() {
                        f.goToPage(o);
                        return false
                    }).append($("<span></span>").html("&raquo;").attr("class", h.nextArrow)))
                } else g = $("<li></li>").attr("class", h.text).append($("<span></span>").html("&raquo;").attr("class", h.nextArrowDisabled));
                d.append(k);
                f.mode & f.settings.pagerMode.nextPrevBeforeNumericPages && d.append(g)
            }
            if (f.mode & f.settings.pagerMode.numericPages) {
                f.mode & f.settings.pagerMode.nextPrevBeforeNumericPages && d.append($("<li>|</li>").attr("class", h.text));
                for (k = 1; k <= a; k++)
                    if (f.pageNumber == k) {
                        e = false;
                        d.append($("<li></li>").attr("class", h.selectedItem).append($("<span></span>").text(k)))
                    } else if (f.pageNumber == k || k == 1 || k == a || Math.abs(f.pageNumber - k) <= f.settings.pageLinksNearSelectedCount) d.append($("<li></li>").append($("<a>" + k + "</a>").attr("href",
                    "#").click({
                    actualPageNumber: k
                }, function(n) {
                    f.goToPage(n.data.actualPageNumber);
                    return false
                })));
                else if (!e) {
                    e = true;
                    d.append($("<li></li>").attr("class", h.text).append("<span>...</span>"))
                }
            }(f.mode & f.settings.pagerMode.nextPrevBeforeNumericPages) == 0 && d.append(g);
            if (f.mode & f.settings.pagerMode.pageSize || f.mode & f.settings.pagerMode.pageSizeDropdown || f.mode & f.settings.pagerMode.pageSizeStaticLabel || f.mode & f.settings.pagerMode.pageInfo) {
                d = $("<span></span>").attr("class", h.pageSizeChooser);
                c.append(d);
                if (f.mode & f.settings.pagerMode.pageInfo) {
                    k = f.pageSize * f.pageNumber;
                    if (k > f.totalCount) k = f.totalCount;
                    c = 1 + f.pageSize * (f.pageNumber - 1);
                    if (f.pageNumber == 0 || f.totalCount == 0) c = 0;
                    d.append($("<span></span>").text(b.pageInfoLabelTemplate.replace("{0}", c).replace("{1}", k).replace("{2}", f.totalCount)))
                }
                c = f.settings.pageSizes;
                if (f.mode & f.settings.pagerMode.pageSize) {
                    a = $("<ul></ul>");
                    d.append(a);
                    a.append($("<li></li>").attr("class", h.pageSizeChooserLabel).text(b.pageSizeChooserLabel));
                    for (k = 0; k < c.length; k++) {
                        e =
                            c[k] == f.pageSize ? $("<li></li>").attr("class", h.selectedItem).text(c[k]) : $("<li></li>").append($("<a></a>").attr("href", "javascript:" + j + ".changePageSize(" + c[k] + ");").text(c[k]));
                        a.append(e)
                    }
                }
                if (f.mode & f.settings.pagerMode.pageSizeDropdown) {
                    k = $("<select></select>");
                    $(k).change(function() {
                        window[j].changePageSize(this.options[this.selectedIndex].value)
                    });
                    d.append(k);
                    for (a = 0; a < c.length; a++) {
                        e = $("<option></option>").attr("value", c[a]).text(b.pageSizeItemPrefix + " " + c[a]);
                        k.append(e)
                    }
                    k.find("option").each(function() {
                        var n =
                            $(this);
                        if (n.val() == f.pageSize) {
                            n.prop("selected", true);
                            return false
                        }
                    })
                }
                f.mode & f.settings.pagerMode.pageSizeStaticLabel && d.append($("<span/>").text(b.pageSizeItemPrefix + " " + f.pageSize).addClass(h.pageSizeStaticLabel))
            }
        };
        f.createIn = function(c) {
            var d = $("<div></div>").prop("className", h.main);
            c.append(d);
            f.controls.pagerContainer = d;
            f.render()
        };
        return f
    }
    (function(j, f) {
        function h(d) {
            return d.find("object, embed")
        }

        function b(d) {
            return d.find("video")
        }
        var c = j.PlayerManager = {
            commonSettings: f,
            addPlayer: function(d, a) {
                return d.jPlayer({
                    ready: function() {
                        var e = {};
                        e[a.format] = a.url;
                        $(this).jPlayer("setMedia", e);
                        if (a.isVideo) {
                            d.css({
                                "line-height": 0
                            });
                            e = b(d);
                            var g = h(d);
                            g.add(e).removeAttr("style");
                            if (a.width && !a.cssClassSize) $("#" + a.playerContainerId).css(a.autoResizable ? "maxWidth" : "width", a.width);
                            if (g.length > 0) {
                                e = a.width ? a.width : d.width();
                                d.css({
                                    "padding-top": (a.height ?
                                        a.height : Math.round(e / 16 * 9)) / e * 100 + "%",
                                    position: "relative"
                                })
                            } else if (c.commonSettings.isIpad) {
                                e = $("<canvas>");
                                e.css({
                                    height: "auto"
                                });
                                d.prepend(e);
                                d.css({
                                    position: "relative",
                                    "padding-top": "6.2%"
                                })
                            } else e.css({
                                position: "inherit"
                            })
                        }
                    },
                    swfPath: c.commonSettings.swfPath,
                    cssSelectorAncestor: "#" + a.playerContainerId,
                    supplied: a.format,
                    size: a.isVideo ? {
                        width: "100%",
                        height: h(d).length > 0 ? "100%" : "auto",
                        cssClass: a.cssClassSize ? a.cssClassSize : c.commonSettings.defaultCssClassSize
                    } : {},
                    sizeFull: a.isVideo ? {
                        width: "100%",
                        height: "auto"
                    } : {},
                    noFullWindow: {
                        msie: /msie/,
                        ipad: /ipad.*?os [0-4]\./,
                        iphone: /iphone/,
                        ipod: /ipod/,
                        android_pad: /android [0-3]\.(?!.*?mobile)/,
                        android_phone: /android.*?mobile/,
                        blackberry: /blackberry/,
                        windows_ce: /windows ce/,
                        iemobile: /iemobile/,
                        webos: /webos/
                    }
                }).on($.jPlayer.event.play, function() {
                    a.isVideo && h(d).add(b(d)).removeAttr("style");
                    c.commonSettings.isIpad || b(d).css({
                        position: "inherit"
                    });
                    $(this).jPlayer("pauseOthers")
                }).on($.jPlayer.event.resize, function(e) {
                    if (a.isVideo) {
                        h(d).add(b(d)).removeAttr("style");
                        d.css({
                            position: e.jPlayer.options.fullScreen || e.jPlayer.options.fullWindow ? "" : "relative"
                        });
                        c.commonSettings.isIpad || b(d).css({
                            position: "inherit"
                        })
                    }
                })
            }
        }
    })(window);

function ProgressBar(j) {
    window[j] = this;
    var f = this,
        h, b;
    f.initialize = function() {
        h = f.settings;
        b = f.controls;
        b.bar.progressbar({
            value: h.percent
        })
    };
    f.setPercent = function(c) {
        b.bar.progressbar("option", {
            value: c
        });
        b.labelContainer.html(c + "%")
    };
    return f
}

function CclResponsiveGrid(j) {
    function f(n) {
        return n.replace(/^\s+|\s+$/, "")
    }

    function h(n) {
        var m = k.scrollTop(),
            p = k.scrollLeft(),
            r = a.offset();
        r.frameTop = 0;
        r.frameLeft = 0;
        if (l) {
            var B = $('iframe[name="mainmenu"]', k[0].document).offset();
            r.frameTop = B.top;
            r.frameLeft = B.left
        }
        B = r.top + r.frameTop + a.outerHeight() - e.outerHeight();
        if (m >= r.top + r.frameTop && m < B) {
            if (!e.hasClass(o)) {
                g.height(e.height()).show();
                e.css("width", e.width()).addClass(o)
            }
            n ? e.css("top", m - r.frameTop) : e.css("left", r.left - p)
        } else if (e.hasClass(o)) {
            g.hide();
            e.removeClass(o).css("top", "").css("left", "").css("width", "")
        }
    }

    function b() {
        if (e.hasClass(o)) {
            e.removeClass(o).css("width", "");
            g.height(e.height());
            e.css("width", e.width()).addClass(o)
        }
    }

    function c(n) {
        return $.map(n.find("div > ul." + d.cclGridConstants.cssClasses.gridRow).parent(), function(m) {
            var p = parseInt($(m).find("ul > li." + d.cclGridConstants.cssClasses.rowDetailsColumn + ' > input[type="hidden"].' + d.cclGridConstants.cssClasses.orderValue).val()),
                r = parseInt($(m).index()) + 1 + (d.pageNumber - 1) * d.pageSize;
            if (p !== r) return {
                elementPrimaryKey: $(m).find("ul > li." + d.cclGridConstants.cssClasses.rowDetailsColumn + ' > input[type="hidden"].' + d.cclGridConstants.cssClasses.primaryKey).val(),
                elementNewIndex: $(m).index(),
                elementNewOrderValue: r
            };
            return null
        })
    }
    window[j] = this;
    var d = this;
    d.name = j;
    d.gridClientID = null;
    d.pageSize = null;
    d.pageNumber = null;
    d.pagerInstanceName = null;
    d.cclGridConstants = null;
    d.pageNumberHiddenClientID = null;
    d.pageSizeHiddenClientID = null;
    d.preferenceCategoryName = null;
    d.selectingHiddenClientID = null;
    d.sortingHiddenClientID = null;
    d.filteringHiddenClientID = null;
    d.selectColumn = null;
    d.selectedRow = null;
    d.ajaxSettings = null;
    d.totalCount = 0;
    d.freezeToolbar = false;
    d.filteringPreference = null;
    d.sortingProperty = null;
    d.isIos = false;
    d.isReorderModeAvailable = false;
    d.orderProperty = null;
    d.reorderTogglerClientId = null;
    d.isReorderModeOn = false;
    d.isReorderModeHandlerAttached = false;
    var a, e, g, k = $(window),
        l = false,
        o;
    d.initialize = function() {
        a = $("#" + d.gridClientID);
        e = a.find("." + d.cclGridConstants.cssClasses.toolbar);
        d.restoreState();
        d.attachEvents();
        d.ajaxSettings.useAjaxMode && d.ajaxSettings.dataSourceWebMethodUrl && !d.ajaxSettings.delayedInitialization && d.refresh();
        if (d.freezeToolbar && e.length) {
            o = d.cclGridConstants.cssClasses.toolbarFreeze;
            g = $('<div style="display:none;"/>').attr("class", e.attr("class")).insertAfter(e);
            if (d.isIos)
                if (l = window.top != window) {
                    k = $(window.top);
                    var n = function() {
                        h(true)
                    };
                    k.on("scroll", n);
                    $(window).on("unload", function() {
                        k.off("scroll", n)
                    })
                }
            $(window).scroll(function() {
                h()
            }).resize(function() {
                b()
            })
        }
    };
    d.useAjaxMode =
        function() {
            return d.ajaxSettings && d.ajaxSettings.useAjaxMode
        };
    d.goToPage = function(n) {
        document.getElementById(d.selectingHiddenClientID).value = "";
        d.pageNumber = n;
        d.refresh();
        $(window).scrollTop(0)
    };
    d.sort = function(n) {
        if (d.sortingProperty != n) {
            d.sortingProperty = n;
            d.goToPage(1)
        }
    };
    d.filter = function(n) {
        if (d.filteringPreference != n) {
            d.filteringPreference = n;
            d.goToPage(1)
        }
    };
    d.changePageSize = function(n) {
        d.pageSize = n;
        d.goToPage(1)
    };
    d.restoreState = function() {
        d.pageSize = parseInt(document.getElementById(d.pageSizeHiddenClientID).value,
            10);
        d.pageNumber = parseInt(document.getElementById(d.pageNumberHiddenClientID).value, 10);
        d.sortingProperty = document.getElementById(d.sortingHiddenClientID).value;
        d.filteringPreference = document.getElementById(d.filteringHiddenClientID).value
    };
    d.saveState = function() {
        document.getElementById(d.pageSizeHiddenClientID).value = d.pageSize;
        document.getElementById(d.pageNumberHiddenClientID).value = d.pageNumber;
        document.getElementById(d.sortingHiddenClientID).value = d.sortingProperty;
        document.getElementById(d.filteringHiddenClientID).value =
            d.filteringPreference
    };
    d._addRemoveSelectedValue = function(n, m) {
        m ? CommonFunctions.addIdToHidden(d.selectingHiddenClientID, n) : CommonFunctions.removeIdFromHidden(d.selectingHiddenClientID, n)
    };
    d.toggleSelect = function(n) {
        d._applySelectedRowClass(n.parentNode.parentNode, n.checked);
        a.find("." + d.cclGridConstants.cssClasses.selectColumn + " input:checkbox").each(function(m, p) {
            d._addRemoveSelectedValue(p.value, p.checked)
        })
    };
    d.getSelectedValues = function() {
        var n = $("#" + d.selectingHiddenClientID).val();
        if (n.length ==
            0) return [];
        return n.slice(0, n.length - 1).split(",")
    };
    d.replaceKeyValue = function(n, m) {
        a.find("." + d.cclGridConstants.cssClasses.selectColumn + " input:checkbox[value='" + n + "']").each(function(r, B) {
            B.value = m;
            if (B.checked) {
                d._addRemoveSelectedValue(n, false);
                d._addRemoveSelectedValue(m, true)
            }
        });
        var p = d.cclGridConstants.cssClasses.gridRow + "-";
        a.find("." + p + n + ":first").removeClass(p + n).addClass(p + m)
    };
    d.getRowById = function(n) {
        return a.find("." + d.cclGridConstants.cssClasses.gridRow + "-" + n + ":first")
    };
    d.getRowsContainer =
        function() {
            return a.find("." + d.cclGridConstants.cssClasses.gridRowsContainer + ":first")
        };
    d.getRowsCount = function() {
        return d.getRowsContainer().find("." + d.cclGridConstants.cssClasses.gridRow).length
    };
    d.toggleRowStatus = function(n, m) {
        return d.getRowById(n).parent().toggleClass(d.cclGridConstants.cssClasses.inactiveRow, !m)
    };
    d.getGridElement = function() {
        return a
    };
    d.getToolbarElement = function() {
        return e
    };
    d.getFeedback = function() {
        return window[d.feedbackInstanceName]
    };
    d.clearSelection = function() {
        $("#" + d.selectingHiddenClientID).val("")
    };
    d._applySelectedRowClass = function(n, m) {
        if (m) {
            var p = d.cclGridConstants.cssClasses.selectedRow;
            n.className = f(n.className.replace(p, ""));
            n.className = f(n.className + " " + p)
        } else n.className = f(n.className.replace(d.cclGridConstants.cssClasses.selectedRow, ""))
    };
    d.toggleSelectAll = function(n) {
        a.find("." + d.cclGridConstants.cssClasses.selectColumn + " input:checkbox").each(function(m, p) {
            p.checked = n;
            d._addRemoveSelectedValue(p.value, n);
            d._applySelectedRowClass(p.parentNode.parentNode, n)
        })
    };
    d.appendTextToGridContainer =
        function(n) {
            var m = d.getRowsContainer();
            n = $("<div></div>").addClass(d.cclGridConstants.cssClasses.gridText).html(n);
            m.html(n)
        };
    d.refresh = function() {
        d.saveState();
        d.appendTextToGridContainer(d.cclGridConstants.terms.ajaxLoadingText);
        d.updateFreezeState();
        if (d.ajaxSettings.useAjaxMode) return $.ajax({
            type: "POST",
            url: d.ajaxSettings.dataSourceWebMethodUrl,
            data: "pageNumber=" + d.pageNumber + "&pageSize=" + d.pageSize + "&sort=" + d.sortingProperty + "&filter=" + d.filteringPreference + d._getParamsStr(),
            dataType: "json",
            success: function(n) {
                d.render(n);
                d.updateFreezeState()
            },
            error: function() {
                d.appendTextToGridContainer(d.cclGridConstants.terms.ajaxErrorText)
            }
        });
        else d.postbackFunction()
    };
    d._getParamsStr = function() {
        var n = "";
        $.each(d.ajaxSettings.dataSourceWebMethodParams, function(m, p) {
            n += "&" + m + "=" + escape(p)
        });
        return n
    };
    d.getRowPrimaryKeyValue = function(n) {
        return d.getCurrentRow(n).find("." + d.cclGridConstants.cssClasses.rowDetailsColumn + " ." + d.cclGridConstants.cssClasses.primaryKey).val()
    };
    d.getRowPrimaryKeyValueByIndex =
        function(n) {
            return d.getRowsContainer().find("." + d.cclGridConstants.cssClasses.gridRow + ":eq(" + n + ") ").find("." + d.cclGridConstants.cssClasses.rowDetailsColumn + " ." + d.cclGridConstants.cssClasses.primaryKey).val()
        };
    d.getRowIndex = function(n) {
        return d.getCurrentRow(n).find("." + d.cclGridConstants.cssClasses.rowDetailsColumn + " ." + d.cclGridConstants.cssClasses.rowIndex).val()
    };
    d.getCurrentRow = function(n) {
        return $(n).parents("." + d.cclGridConstants.cssClasses.gridRow)
    };
    d.render = function(n, m) {
        if (m = typeof m !==
            "undefined" ? m : false) d.totalCount += n.virtualCount;
        else d.totalCount = n.virtualCount;
        d.reInitializePager(d.pageNumber, d.pageSize, d.totalCount);
        var p = d.getRowsContainer();
        m ? p.append(n.gridData) : p.html(n.gridData);
        d.isReorderModeAvailable && $("#" + d.reorderTogglerClientId).parent("li").removeClass(d.cclGridConstants.cssClasses.selectedItem);
        if (d.orderProperty.length > 0) {
            d.isReorderModeAvailable = d.sortingProperty.indexOf(d.orderProperty) >= 0 && d.totalCount > 1;
            d.attachReorderModeHandler();
            d.reorderTogglerClientId.length >
                0 && d.toggleReorderTogglerElement($("#" + d.reorderTogglerClientId), d.isReorderModeAvailable);
            d.reorderModeAjaxSettings.reorderMode == "Auto" && d.toggleReorderMode()
        }
        a.trigger("datachanged")
    };
    d.addNewRow = function() {
        $.ajax({
            type: "POST",
            url: d.addNewSettings.webMethodUrl,
            data: d.addNewSettings.params || "{}",
            dataType: "json",
            success: function(n) {
                d.render(n, true);
                d.updateFreezeState();
                d.getRowsCount() > 0 && d.getEmptyTextContainer().hide()
            },
            error: function() {
                d.appendTextToGridContainer(d.cclGridConstants.terms.ajaxErrorText)
            }
        })
    };
    d.attachEvents = function() {
        a.on("click", "." + d.cclGridConstants.cssClasses.selectColumn + " input[type=checkbox]", function() {
            d.toggleSelect(this)
        });
        a.on("change", "." + d.cclGridConstants.cssClasses.sorting + " > select", function() {
            var n = $(this).val();
            d.sort(n)
        });
        d.freezeToolbar && d.isIos && a.on("hybrideditoriteminlinemodechanged", function(n, m) {
            m.isEditMode || h(true)
        });
        d.isReorderModeAvailable && d.attachReorderModeHandler()
    };
    d.reInitializePager = function(n, m, p) {
        var r = window[d.pagerInstanceName];
        if (r) {
            r.pageNumber =
                n;
            r.pageSize = m;
            r.totalCount = p;
            r.render();
            r.controls.pagerContainer.toggle(p > 0)
        }
    };
    d.updateFreezeState = function(n) {
        if (d.freezeToolbar && e.length) {
            h(n);
            b()
        }
    };
    d.removeEmptyText = function() {
        d.getEmptyTextContainer().remove()
    };
    d.getEmptyTextContainer = function() {
        return d.getRowsContainer().children("." + d.cclGridConstants.cssClasses.emptyGridText)
    };
    d.getRowOrderPropertyValue = function(n) {
        return n.find("." + d.cclGridConstants.cssClasses.rowDetailsColumn + " ." + d.cclGridConstants.cssClasses.orderValue).val()
    };
    d.setRowOrderPropertyValue =
        function(n, m) {
            return n.find("." + d.cclGridConstants.cssClasses.rowDetailsColumn + " ." + d.cclGridConstants.cssClasses.orderValue).val(m)
        };
    d.setRowIndexPropertyValue = function(n, m) {
        return n.find("." + d.cclGridConstants.cssClasses.rowDetailsColumn + " ." + d.cclGridConstants.cssClasses.rowIndex).val(m)
    };
    d.attachReorderModeHandler = function() {
        if (!d.isReorderModeHandlerAttached)
            if (d.isReorderModeAvailable) {
                $("." + d.cclGridConstants.cssClasses.reorderModeSelector).sortable({
                    axis: "y",
                    scrollSensitivity: 100,
                    handle: "." +
                        d.cclGridConstants.cssClasses.reorderModeDragHandler,
                    cursor: "move"
                });
                $("." + d.cclGridConstants.cssClasses.reorderModeSelector).on("sortstart", function(n, m) {
                    m.item.data("reorderItemEntityId", d.getRowPrimaryKeyValueByIndex(m.item.index()));
                    m.item.data("oldOrderValue", d.getRowOrderPropertyValue(m.item));
                    m.item.data("oldIndexValue", m.item.index())
                });
                $("." + d.cclGridConstants.cssClasses.reorderModeSelector).on("sortchange", function() {});
                $("." + d.cclGridConstants.cssClasses.reorderModeSelector).on("sortstop",
                    function(n, m) {
                        var p = parseInt(m.item.data("oldOrderValue")),
                            r = parseInt(m.item.data("oldIndexValue")),
                            B = parseInt(m.item.index());
                        if (r !== B) {
                            B > r ? m.item.data("newOrderValue", p + (B - r)) : m.item.data("newOrderValue", p - (r - B));
                            d.useAjaxMode() && d.callReorderModeUpdateMethod(m.item, c($(this)))
                        }
                    });
                $("." + d.cclGridConstants.cssClasses.reorderModeSelector).on("sortupdate", function() {});
                d.isReorderModeHandlerAttached = true
            }
    };
    d.toggleReorderMode = function() {
        d.isReorderModeOn = d.reorderModeAjaxSettings.reorderMode == "Auto" ?
            true : !d.isReorderModeOn;
        $("#" + d.reorderTogglerClientId).parent("li").toggleClass(d.cclGridConstants.cssClasses.selectedItem, d.isReorderModeOn);
        a.find("." + d.cclGridConstants.cssClasses.reorderModeColumnSelector + " div").toggleClass(d.cclGridConstants.cssClasses.reorderModeDragHandler, d.isReorderModeOn);
        a.find("." + d.cclGridConstants.cssClasses.reorderModeColumnSelector + " div > img").toggleClass(d.cclGridConstants.cssClasses.hidden, !d.isReorderModeOn)
    };
    d._getReorderParamsStr = function() {
        var n = "";
        $.each(d.reorderModeAjaxSettings.reorderModeWebMethodParams,
            function(m, p) {
                n += "&" + m + "=" + escape(p)
            });
        return n
    };
    d.callReorderModeUpdateMethod = function(n, m) {
        return $.ajax({
            type: "POST",
            url: d.reorderModeAjaxSettings.reorderModeWebMethodUrl,
            data: "entityId=" + n.data("reorderItemEntityId") + "&oldValue=" + n.data("oldOrderValue") + "&newValue=" + n.data("newOrderValue") + d._getReorderParamsStr(),
            dataType: "json",
            success: function(p) {
                for (var r = 0; r < m.length; r++) {
                    d.setRowIndexPropertyValue(d.getRowById(m[r].elementPrimaryKey), m[r].elementNewIndex);
                    d.setRowOrderPropertyValue(d.getRowById(m[r].elementPrimaryKey),
                        parseInt(m[r].elementNewOrderValue))
                }
                typeof d.reorderModeAjaxSettings.reorderModeCallbackClientFunction !== "undefined" && d.reorderModeAjaxSettings.reorderModeCallbackClientFunction(p)
            },
            error: function() {
                $("." + d.cclGridConstants.cssClasses.reorderModeSelector).sortable("cancel")
            }
        })
    };
    d.toggleReorderTogglerElement = function(n, m) {
        var p = n.attr("id"),
            r = n.html(),
            B = n.attr("class");
        if (m) {
            n.parent("li").removeClass("disabled");
            n.replaceWith('<a href="#" id="' + p + '" class="' + B + '" onclick="javascript:' + this.name +
                '.toggleReorderMode();">' + r + "</a>")
        } else {
            n.parent("li").addClass("disabled");
            n.replaceWith('<span id="' + p + '" class="' + B + '">' + r + "</span>")
        }
    }
}
$.widget("itslccl.searchTextBox", $.itslccl.extendedTextBox, {
    options: {
        searchInput: undefined,
        container: undefined,
        searchLink: undefined,
        fakeInput: undefined,
        searchKeyStorage: undefined,
        textSearchEvent: undefined,
        usePostBack: false,
        clearByEsc: false,
        postBackReference: undefined
    },
    _create: function() {
        this._super();
        var j = this,
            f = this.options.searchInput,
            h = this.options.searchLink,
            b = this.options.fakeInput;
        f.keydown(function(c) {
            if (c.which === CommonConstants.keyCodes.enter && !c.shiftKey) {
                j._doSearch();
                return false
            }
            return true
        });
        f.keyup(function(c) {
            j.options.clearByEsc && c.which === CommonConstants.keyCodes.escape && j._clearSearchBox();
            return true
        });
        h && h.click(function(c) {
            c.preventDefault();
            j._doSearch()
        });
        b && b.focus(function() {
            f.focus()
        })
    },
    _clearSearchBox: function() {
        this.options.searchInput.val("");
        this.options.searchInput.focus()
    },
    _doSearch: function() {
        this.options.searchInput.focus();
        var j = this._isWatermarkMode ? "" : $.trim(this.options.searchInput.val());
        if (this.options.usePostBack) {
            this._saveSearchTextToHiddenField();
            eval(this.options.postBackReference)
        } else this.options.container.trigger(this.options.textSearchEvent,
            j)
    },
    _saveSearchTextToHiddenField: function(j) {
        !this.options.usePostBack && j ? this.options.searchKeyStorage.val($.trim(j)) : this.options.searchKeyStorage.val($.trim(this.options.searchInput.val()))
    }
});

function SearchTextBox(j, f) {
    window[j] = this;
    var h = this;
    f && SearchTextBox.instances.push(this);
    h.initialize = function() {
        h.controls = {
            searchInput: $("#" + h.controlIds.searchInputId),
            container: $("#" + h.controlIds.containerId),
            searchLink: $("#" + h.controlIds.searchLinkId),
            fakeInput: $("#" + h.controlIds.fakeInputId),
            searchKeyStorage: $("#" + h.controlIds.searchKeyStorageId)
        };
        var b = h.controls.searchInput;
        f && b.hasClass(h.settings.focusRequiredCssClass) && b.focus();
        b.searchTextBox({
            searchInput: h.controls.searchInput,
            container: h.controls.container,
            searchLink: h.controls.searchLink,
            fakeInput: h.controls.fakeInput,
            searchKeyStorage: h.controls.searchKeyStorage,
            watermarkText: h.settings.watermarkText,
            watermarkCssClass: h.settings.watermarkCssClass,
            textSearchEvent: h.settings.textSearchEvent,
            clearByEsc: h.settings.clearByEsc,
            usePostBack: h.settings.usePostBack,
            postBackReference: h.settings.postBackReference,
            focusRequiredCssClass: h.settings.focusRequiredCssClass
        })
    };
    h.clearSearch = function() {
        h.controls.searchInput.val("")
    };
    h.autocompleteopen = function() {
        var b =
            h.controls.searchInput.autocomplete("widget");
        if ($(".ui-menu-item", b).length > 1) {
            var c = h.controls.searchInput.autocomplete("option", "select");
            h.controls.searchInput.autocomplete({
                select: function(a, e) {
                    if (e.item.id !== -1) c(a, e);
                    else {
                        var g = [];
                        $(".ui-menu-item:not(.ccl-searchtextbox-select-all)", b).each(function() {
                            g.push($(this).data("ui-autocomplete-item"))
                        });
                        h.controls.searchInput.trigger("autocompleteselectall", {
                            items: g
                        });
                        h.controls.searchInput.autocomplete("close")
                    }
                }
            });
            var d = $("<li></li>").data("item.autocomplete", {
                id: -1,
                value: ""
            }).attr("class", "ui-menu-item ccl-searchtextbox-select-all").appendTo(b);
            $("<a></a>").attr("href", "#").text(h.settings.selectAllText).appendTo(d)
        }
    }
}
SearchTextBox.instances = [];
SearchTextBox.initialize = function() {
    for (var j = 0, f = this.instances.length; j < f; j += 1) this.instances[j].initialize()
};

function StarsSelector(j) {
    window[j] = this;
    var f = this,
        h, b;
    f.initialize = function() {
        function c(d) {
            d = isNaN(d) ? 0 : d;
            b.filter(":lt(" + d + ")").find("img").prop("src", f.settings.activeIconUrl);
            b.filter(":eq(" + d + "), :gt(" + d + ")").find("img").prop("src", f.settings.inactiveIconUrl)
        }
        h = f.controls.ratingHidden;
        b = f.controls.starsContainer.find("a");
        b.click(function() {
            var d = b.index(this) + 1;
            if (h.val() != d) {
                h.val(d).change();
                c(d)
            }
            return false
        }).mouseover(function() {
            c(b.index(this) + 1)
        }).mouseout(function() {
            c(parseInt(h.val()))
        });
        h.on(f.settings.showRateEventName, function() {
            c($(this).val())
        })
    };
    return f
}

function MakeTableHighlightable(j) {
        function f(h) {
            var b = h.type == "mouseenter";
            $("tr > :nth-child(" + ($(this).index() + 1) + ")", $(h.delegateTarget)).toggleClass("ccl-table-highlight", b);
            $(this).parent().toggleClass("ccl-table-highlight", b)
        }
        j.delegate("td", "mouseenter mouseleave", f);
        j.delegate("tbody th", "mouseenter mouseleave", f)
    }
    (function(j, f) {
        var h = j.TextBoxAutoCompleteManager = {
            commonSettings: f,
            makeTextBoxAutocomplete: function(b, c, d, a) {
                function e() {
                    if (m.autocomplete("widget").is(":visible")) m.autocomplete("close");
                    else {
                        $(".ui-autocomplete-input ui-autocomplete-loading").autocomplete("close");
                        m.autocomplete("option", "minLength", 0);
                        m.autocomplete("search", "")
                    }
                    m.focus()
                }

                function g() {
                    var B = m.get(0);
                    b.isIos ? B.setSelectionRange(0, B.value.length) : B.select()
                }

                function k(B, ca) {
                    var z = false;
                    $.each(B, function(S, ha) {
                        var wa = b.caseSensitiveSearch ?
                            ca : ca.toLowerCase();
                        if ((b.caseSensitiveSearch ? ha.value : ha.value.toLowerCase()) === wa) {
                            z = true;
                            return false
                        }
                    });
                    return z
                }

                function l() {
                    if (!b.allowCustomText)
                        if (k(b.values, m.val())) b.defaultValue = m.val();
                        else {
                            b.defaultValue ? m.val(b.defaultValue) : m.val("");
                            o(false)
                        }
                    c && c();
                    b.isAutoPostBack && m.closest("form").submit()
                }

                function o(B) {
                    b.useHighlight && p.toggleClass(h.commonSettings.cssClasses.highlight, B)
                }
                var n = true,
                    m = $("#" + b.textboxId),
                    p = m.parent(),
                    r = j[b.textboxId] = m;
                if (b.isDropDown) b.minLength = 0;
                m.autocomplete({
                    autoFocus: true,
                    source: function(B, ca) {
                        ca($.map(b.values, function(z) {
                            var S = b.caseSensitiveSearch ? B.term : B.term.toLowerCase(),
                                ha = b.caseSensitiveSearch ? z.value : z.value.toLowerCase();
                            switch (b.filterType) {
                                case h.commonSettings.filterType.startsWith:
                                    return ha.indexOf(S) == 0 ? z : f;
                                default:
                                    return ha.indexOf(S) >= 0 ? z : f
                            }
                        }))
                    },
                    delay: b.delay,
                    minLength: b.minLength,
                    change: function() {
                        b.defaultValue !== m.val() && l()
                    },
                    close: function() {
                        d && d();
                        n = true
                    },
                    select: function(B, ca) {
                        r.selectValue(ca.item)
                    },
                    open: function() {
                        b.zIndex && m.autocomplete("widget").css("z-index",
                            b.zIndex);
                        n = false
                    },
                    messages: {
                        noResults: b.terms.noResults,
                        results: function(B) {
                            return B == 1 ? b.terms.oneResult : b.terms.resultsTemplate.replace("{0}", B.toString())
                        }
                    }
                });
                m.keyup(function() {
                    o(!!m.val() && !k(b.values, m.val()))
                }).keydown(function(B) {
                    if (B.which === CommonConstants.keyCodes.enter) {
                        n || B.preventDefault();
                        if (b.defaultValue !== m.val()) {
                            B.preventDefault();
                            l()
                        }
                        m.autocomplete("close")
                    }
                }).click(g).on("autocompletesearchcomplete", function() {});
                r.selectValue = function(B) {
                    o(false);
                    m.val(B.value);
                    $(".ui-autocomplete-input ui-autocomplete-loading").autocomplete("close");
                    a && a(B)
                };
                if (b.isDropDown) {
                    $("#" + b.buttonId).click(e).click(g);
                    m.click(e)
                }
            }
        }
    })(window);
(function(j) {
    var f = {},
        h = false,
        b = j.TextEditorManager = {
            commonSettings: undefined,
            addStartupFunction: function(c, d) {
                f[c] = d
            },
            textEditorSetup: function() {
                function c(d, a, e) {
                    if (d = d.getButton(a)) {
                        e = $("#" + d.domId).removeClass().addClass(e).removeAttr("title");
                        d = e.find("span").removeClass();
                        e.append(document.createTextNode(d.text()));
                        d.text("")
                    }
                }
                if (!h) {
                    h = true;
                    CKEDITOR.on("dialogDefinition", function(d) {
                        d = d.data.definition;
                        var a = d.onLoad;
                        d.onLoad = function() {
                            c(this, "ok", b.commonSettings.cssClasses.ok);
                            c(this, "cancel",
                                b.commonSettings.cssClasses.cancel);
                            if (a) return a.apply(this, arguments)
                        }
                    });
                    CKEDITOR.on("instanceReady", function(d) {
                        (d = f[d.editor.name]) && d()
                    })
                }
            }
        }
})(window);

function InsertHtml(j, f) {
    var h = null;
    h = f && f.length > 0 ? CKEDITOR.instances[f] : CKEDITOR.dialog.getCurrent()._.editor;
    if (h != null)
        if (CKEDITOR.env.webkit)
            if (h.config.mask && IsEditorEmpty(h.name, h.config.mask)) {
                SetHtml(j, f);
                checkForMaskAndDelete(h.name)
            } else h.insertHtml(j);
    else {
        CKEDITOR.env.gecko && h.config.mask && checkForMaskAndDelete(h.name);
        h.insertHtml(j)
    }
}

function CloseDialog() {
    window.CKEDITOR.env.webkit && closeRecorderIfExists();
    CKEDITOR.dialog.getCurrent().hide()
}

function SetHtml(j, f) {
    f && f.length > 0 ? CKEDITOR.instances[f].setData(j) : CKEDITOR.dialog.getCurrent()._.editor.setData(j)
}

function GetTextEditorContent(j) {
    if (j && j.length > 0) return CKEDITOR.instances[j].getData();
    if (CKEDITOR.dialog.getCurrent()) return CKEDITOR.dialog.getCurrent()._.editor.getData();
    return null
}

function SetTextEditorFocus(j) {
    CKEDITOR.instances[j].focus()
}

function RemoveEditorInstance(j) {
    if (CKEDITOR.instances[j]) {
        var f = CKEDITOR.instances[j].editable();
        if (f.hasFocus) {
            f.blur();
            f.hasFocus = false
        }
        CKEDITOR.instances[j].destroy()
    }
}

function IsEditorEmpty(j, f) {
    var h = CKEDITOR.instances[j];
    if (h) {
        h = h.getData().replace("\n", "");
        if ("" == h || f && h === f || "<p>&nbsp;</p>" == h || "<div>&nbsp;</div>" == h || "<p>&#160;</p>" == h || "<p></p>" == h) return true;
        return false
    }
}

function isTextEditorDirty(j) {
    var f;
    if (j && j.length > 0 && (f = CKEDITOR.instances[j])) return f.checkDirty();
    if (CKEDITOR.dialog.getCurrent()) return CKEDITOR.dialog.getCurrent()._.editor.checkDirty()
}

function resetEditorIsDirty(j) {
    if (j && j.length > 0) return CKEDITOR.instances[j].resetDirty();
    if (CKEDITOR.dialog.getCurrent()) return CKEDITOR.dialog.getCurrent()._.editor.resetDirty()
}

function setTextEditorTextColor(j, f) {
    var h = CKEDITOR.instances[j],
        b = new CKEDITOR.style(CKEDITOR.config.colorButton_foreStyle, {
            color: f
        });
    h.applyStyle(b)
}

function setTextEditorTextSize(j, f) {
    var h = CKEDITOR.instances[j],
        b = new CKEDITOR.style(CKEDITOR.config.fontSize_style, {
            size: f
        });
    h.applyStyle(b)
}
var focusListener = function(j) {
        if (IsEditorEmpty(j.editor.name, j.editor.config.mask)) {
            j.editor.document.getBody().setHtml("");
            j.editor.mayBeDirty = true;
            resetEditorIsDirty(j.editor.name)
        }
    },
    blurListener = function(j) {
        if (IsEditorEmpty(j.editor.name))
            if (j.editor.config.mask && j.editor.config.mask.length > 0) {
                j.editor.document.getBody().setHtml(j.editor.config.mask);
                resetEditorIsDirty(j.editor.name)
            }
    };

function cleanOnFocusEvent(j, f, h) {
    var b = CKEDITOR.instances[f];
    b.config.mask = j;
    if (h || IsEditorEmpty(b.name)) {
        SetHtml(b.config.mask, b.name);
        b.mayBeDirty = false;
        resetEditorIsDirty(b.name)
    }
    if (b) {
        b.on("focus", focusListener);
        b.on("blur", blurListener)
    }
    window.CKEDITOR.env.ie && AttachListenersToInsertEvents(f)
}

function closeRecorderIfExists() {
    var j = $("#" + CKEDITOR.dialog.getCurrent()._.contents.iframe.undefined.domId).contents().find("object");
    j && j.hide()
}

function checkForMaskAndDelete(j) {
    var f = null;
    if (j && j.length > 0) f = CKEDITOR.instances[j];
    else if (CKEDITOR.dialog.getCurrent()) f = CKEDITOR.dialog.getCurrent()._.editor;
    f != null && f.config.mask && IsEditorEmpty(f.name, f.config.mask) && f.document.getBody().setHtml("")
}

function AttachListenersToInsertEvents(j) {
    if (j && j.length > 0) {
        var f = CKEDITOR.instances[j];
        f.on("insertText", function() {
            checkForMaskAndDelete(j)
        });
        f.on("insertElement", function() {
            checkForMaskAndDelete(j)
        });
        f.on("insertHtml", function() {
            checkForMaskAndDelete(j)
        })
    }
}

function TextEditorToolbar(j) {
    function f(a) {
        a.parent("ul").children("li").removeClass("active");
        a.addClass("active")
    }
    window[j] = this;
    var h = this,
        b, c, d;
    h.initialize = function() {
        c = h.controls.container.find("." + h.settings.fontColorSectionClass).find("li");
        d = h.controls.container.find("." + h.settings.fontSizeSectionClass).find("li");
        CKEDITOR.on("instanceReady", function() {
            b = CKEDITOR.instances[h.settings.editorId];
            b.on("selectionChange", function() {
                h.updateToolbarState()
            });
            c.find("a").click(function() {
                var a =
                    $(this).parent("li"),
                    e = a.find("input:hidden:first").val();
                SetTextEditorFocus(h.settings.editorId);
                setTextEditorTextColor(h.settings.editorId, e);
                f(a);
                return false
            });
            d.find("a").click(function() {
                var a = $(this).parent("li"),
                    e = a.find("input:hidden:first").val();
                SetTextEditorFocus(h.settings.editorId);
                setTextEditorTextSize(h.settings.editorId, e);
                f(a);
                return false
            });
            h.updateToolbarState()
        })
    };
    h.insertImage = function(a) {
        InsertHtml('<img src="' + a + '" alt="" />', h.settings.editorId)
    };
    h.updateToolbarState = function() {
        var a =
            b.getSelection();
        if (a) {
            var e, g;
            if (a = $(a.getStartElement().$)) {
                g = a.prop("style").color;
                if (!g)
                    if ((e = a.parents('span[style*="color:"]:first')) && e.prop("style")) g = e.prop("style").color;
                e = g;
                if (g = e.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)) {
                    e = [];
                    e.push("#");
                    e.push(("0" + parseInt(g[1], 10).toString(16)).slice(-2));
                    e.push(("0" + parseInt(g[2], 10).toString(16)).slice(-2));
                    e.push(("0" + parseInt(g[3], 10).toString(16)).slice(-2));
                    g = e.join("")
                } else g = e;
                g = g.toLowerCase();
                e = a.prop("style").fontSize;
                if (!e)
                    if ((a = a.parents('span[style*="font-size:"]:first')) &&
                        a.prop("style")) e = a.prop("style").fontSize
            }
            g || (g = "#000000");
            if (!e) e = h.settings.defaultFontSizeStyle;
            c.removeClass("active");
            c.filter(":has(input[value='" + g + "']:hidden)").addClass("active");
            d.removeClass("active");
            e && d.filter(":has(input[value='" + e + "']:hidden)").addClass("active")
        }
    }
}

function TextEditorToolbarExtenderDialog(j) {
    window[j] = this;
    var f = this;
    f.initialize = function() {
        f.controls.targetlink.on("click", function(h) {
            h.preventDefault();
            f.show();
            return false
        });
        f.controls.closelink.on("click", function(h) {
            h.preventDefault();
            f.hide();
            return false
        });
        f.controls.container.appendTo("body").on("click", function(h) {
            h.preventDefault();
            return false
        });
        f.controls.container.find("ul li a").on("click", function() {
            f.hide();
            return true
        });
        $(document).click(function(h) {
            var b = f.controls.container;
            if (h.button < 2 && !b.is(":hidden")) {
                f.hide();
                return false
            }
            return true
        })
    };
    f.show = function() {
        var h = f.controls.targetlink.offset();
        f.controls.container.css({
            top: h.top + f.controls.targetlink.height() + "px",
            left: h.left + "px"
        }).show()
    };
    f.hide = function() {
        f.controls.container.hide()
    };
    return f
}

function TimeSlotPicker(j) {
    function f() {
        a.val(c.val())
    }
    window[j] = this;
    var h = this,
        b, c, d, a, e;
    h.initialize = function() {
        b = $("#" + h.settings.clientIds.timeSlotPickerPanel);
        c = $("#" + h.settings.clientIds.timeSlotDropDown);
        d = $("#" + h.settings.clientIds.availableTimeSlotsHidden);
        a = $("#" + h.settings.clientIds.selectedTimeSlotIdHidden);
        c.change(function() {
            f()
        });
        var g = d.val();
        if (g) e = JSON.parse(g);
        h.toggle(true)
    };
    h.toggle = function(g) {
        b.toggle(g && !!e)
    };
    h.updateFilteredTimeForDate = function(g, k) {
        if (h.getAvailableTimeSlotsForDateFunction) {
            var l = {
                date: g,
                dateFilterId: k
            };
            h.getAvailableTimeSlotsForDateFunction(l);
            e = l.availableTimeSlots;
            d.val(e ? JSON.stringify(e) : "");
            if (e) {
                c.empty();
                if (e && e.length)
                    for (l = 0; l < e.length; l++) c.append("<option value='" + e[l].TimeSlotId + "'>" + e[l].Description + "</option>");
                h.toggle(true);
                f()
            } else h.resetTimes()
        }
    };
    h.resetTimes = function() {
        c.empty();
        e = undefined;
        d.val(e ? JSON.stringify(e) : "");
        f();
        h.toggle(false)
    };
    return h
}

function Toggle(j) {
    function f() {
        if (d.length > 0 && d[0].tagName == "INPUT" && d.attr("type") == "checkbox") {
            e.bind("mousedown", function() {
                return false
            });
            g.bind("mousedown", function() {
                return false
            });
            a.bind(c.options.clientClickEventName, b);
            d.bind("change", h)
        }
    }

    function h() {
        if (d.attr("checked") == "checked") {
            k === "true" && a.removeClass(l.toggleOff).addClass(l.toggleOn);
            g.removeClass(l.checkedLabel).addClass(l.uncheckedLabel);
            e.removeClass(l.uncheckedLabel).addClass(l.checkedLabel)
        } else {
            k === "true" && a.removeClass(l.toggleOn).addClass(l.toggleOff);
            e.removeClass(l.checkedLabel).addClass(l.uncheckedLabel);
            g.removeClass(l.uncheckedLabel).addClass(l.checkedLabel)
        }
        d.trigger(c.options.clientStateChangedEventName)
    }

    function b() {
        d.attr("checked", d.attr("checked") != "checked");
        h()
    }
    window[j] = this;
    var c = this,
        d, a, e, g, k, l;
    c.initialize = function() {
        d = c.controls.checkbox;
        a = c.controls.toggleBox;
        e = c.controls.labelOn;
        g = c.controls.labelOff;
        k = c.options.onOffMode;
        l = c.options.cssClassess;
        f()
    }
}

function ToolTip(j, f) {
        function h(Oa) {
            S = z.scrollLeft();
            ha = z.scrollTop();
            g.offset();
            if (!k) {
                k = c();
                k.appendTo("form")
            }
            $(document).trigger("hideTooltips");
            Ga = k.outerHeight(true);
            qa = k.outerWidth(true);
            if (!l) {
                l = d();
                l.insertAfter(k)
            }
            ma = l.outerHeight(true);
            Ca = l.outerWidth(true);
            n = ma + Ea;
            m = z.width() + S;
            p = z.height() + ha;
            g.height();
            B = Oa.pageX;
            ca = Oa.pageY;
            jb = ca - ha > Ga + n;
            fb = p - ca > Ga + n;
            Xa = jb && !fb;
            o || (o = $("<div></div>").appendTo(l));
            o.attr("class", Xa ? wa.arrowDown : wa.arrowUp);
            k.show();
            l.show();
            o.show();
            Oa = a(Oa);
            k.css({
                top: Xa ?
                    ca - Ga - n : ca + n,
                left: Oa
            });
            La = k.offset();
            r = La.left + k.outerWidth();
            Oa = Xa ? La.top + Ga - Ea : La.top + Ea - ma;
            var Pa;
            Pa = r - Ca;
            Pa = B > Pa ? Pa : B - Ca / 2;
            if (B < La.left + Ca / 2) Pa = La.left;
            l.css({
                top: Oa,
                left: Pa
            })
        }

        function b() {
            if (k && l) {
                k.hide();
                l.hide()
            }
        }

        function c() {
            var Oa = $("<div></div>").addClass(wa.tooltipPopup).hover(function() {
                clearTimeout(Sa)
            }, function() {
                Sa = setTimeout(function() {
                    b()
                }, e.settings.hidePopupTimeout)
            });
            $("<div></div>").addClass(wa.tooltipTitle).appendTo(Oa).html(e.title);
            $("<div></div>").addClass(wa.tooltipDescription).appendTo(Oa).html(e.description);
            return Oa
        }

        function d() {
            return $("<div></div>").addClass(wa.arrowContainer).hover(function() {
                clearTimeout(Sa)
            }, function() {
                Sa = setTimeout(function() {
                    b()
                }, e.settings.hidePopupTimeout)
            })
        }

        function a() {
            var Oa = qa / 2;
            if (B - Oa < S) return S;
            if (B + Oa > m) return m - qa;
            return B - Oa
        }
        window[j] = this;
        var e = this,
            g = f,
            k, l, o, n, m, p, r, B, ca, z = $(window),
            S, ha, wa, La, ma, Ga, qa, Ca, Ea = 1,
            Sa, Wa, fb, jb, Xa;
        e.initialize = function() {
            if (e.dataSource) {
                e.title = e.dataSource[e.dataKey].title;
                e.description = e.dataSource[e.dataKey].description
            }
            wa = e.settings.cssClasses;
            $(document).bind("hideTooltips", function() {
                b()
            });
            g.is("a") || g.addClass(wa.linkToTooltip);
            var Oa = function(Pa) {
                clearTimeout(Wa);
                Wa = setTimeout(function() {
                    clearTimeout(Sa);
                    h(Pa)
                }, e.settings.showPopupTimeout)
            };
            g.hover(function() {}, function() {
                clearTimeout(Wa);
                Sa = setTimeout(function() {
                    b()
                }, e.settings.hidePopupTimeout)
            });
            g.mousemove(function(Pa) {
                Oa(Pa)
            });
            g.bind("ensureTooltipExists", function() {
                if (!k) {
                    k = c();
                    k.appendTo("form")
                }
            })
        };
        e.initializeUnobtrusive = function() {
            wa = e.settings.cssClasses;
            $(document).on("hideTooltips",
                function() {
                    b()
                }).on("hover", "[" + e.settings.attributes.title + "], [" + e.settings.attributes.description + "]", function() {
                g = $(this);
                if (!g.data("tooltip_initialized")) {
                    g.is("a") || g.addClass(wa.linkToTooltip);
                    g.mousemove(function(Oa) {
                        clearTimeout(Wa);
                        Wa = setTimeout(function() {
                            clearTimeout(Sa);
                            e.title = g.attr(e.settings.attributes.title);
                            e.description = g.attr(e.settings.attributes.description);
                            if (k) {
                                k.find("." + wa.tooltipTitle).html(e.title ? e.title : "");
                                k.find("." + wa.tooltipDescription).html(e.description ? e.description :
                                    "")
                            }
                            h(Oa)
                        }, e.settings.showPopupTimeout)
                    });
                    g.on("mouseleave", function() {
                        clearTimeout(Wa);
                        Sa = setTimeout(function() {
                            b()
                        }, e.settings.hidePopupTimeout)
                    }).on("ensureTooltipExists", function() {
                        if (!k) {
                            k = c();
                            k.appendTo("form")
                        }
                    });
                    g.data("tooltip_initialized", true)
                }
            })
        };
        return e
    }
    (function(j) {
        j.fn.autogrow = function() {
            this.filter("textarea").each(function() {
                var f = j(this),
                    h = f.height();
                f.css("lineHeight");
                var b = j("<div></div>").css({
                    position: "absolute",
                    top: -1E4,
                    left: -1E4,
                    width: j(this).width() - parseInt(f.css("paddingLeft")) - parseInt(f.css("paddingRight")),
                    fontSize: f.css("fontSize"),
                    fontFamily: f.css("fontFamily"),
                    lineHeight: f.css("lineHeight"),
                    resize: "none"
                }).appendTo(document.body);
                f = function() {
                    var c = this.value.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;").replace(/\n$/,
                        "<br/>&nbsp;").replace(/\n/g, "<br/>").replace(/ {2,}/g, function(d) {
                        for (var a = "", e = 0; e < d.length - 1; e++) a += "&nbsp;";
                        return a + " "
                    });
                    b.html(c);
                    j(this).css("height", Math.max(b.height() + 20, h))
                };
                j(this).change(f).keyup(f).keydown(f);
                f.apply(this)
            });
            return this
        }
    })(jQuery);
jQuery.cookie = function(j, f, h) {
    if (arguments.length > 1 && String(f) !== "[object Object]") {
        h = jQuery.extend({}, h);
        if (f === null || f === undefined) h.expires = -1;
        if (typeof h.expires === "number") {
            var b = h.expires,
                c = h.expires = new Date;
            c.setDate(c.getDate() + b)
        }
        f = String(f);
        return document.cookie = [encodeURIComponent(j), "=", h.raw ? f : encodeURIComponent(f), h.expires ? "; expires=" + h.expires.toUTCString() : "", h.path ? "; path=" + h.path : "", h.domain ? "; domain=" + h.domain : "", h.secure ? "; secure" : ""].join("")
    }
    h = f || {};
    c = h.raw ? function(d) {
            return d
        } :
        decodeURIComponent;
    return (b = RegExp("(?:^|; )" + encodeURIComponent(j) + "=([^;]*)").exec(document.cookie)) ? c(b[1]) : null
};
(function(j) {
    function f(h) {
        if (typeof h.data === "string") {
            var b = h.handler,
                c = h.data.toLowerCase().split(" ");
            h.handler = function(d) {
                if (!(this !== d.target && (/textarea|select/i.test(d.target.nodeName) || d.target.type === "text" || d.target.type === "password"))) {
                    var a = d.type !== "keypress" && j.hotkeys.specialKeys[d.which],
                        e = String.fromCharCode(d.which).toLowerCase(),
                        g = "",
                        k = {};
                    if (d.altKey && a !== "alt") g += "alt+";
                    if (d.ctrlKey && a !== "ctrl") g += "ctrl+";
                    if (d.metaKey && !d.ctrlKey && a !== "meta") g += "meta+";
                    if (d.shiftKey && a !== "shift") g +=
                        "shift+";
                    if (a) k[g + a] = true;
                    else {
                        k[g + e] = true;
                        k[g + j.hotkeys.shiftNums[e]] = true;
                        if (g === "shift+") k[j.hotkeys.shiftNums[e]] = true
                    }
                    a = 0;
                    for (e = c.length; a < e; a++)
                        if (k[c[a]]) return b.apply(this, arguments)
                }
            }
        }
    }
    j.hotkeys = {
        version: "0.8",
        specialKeys: {
            8: "backspace",
            9: "tab",
            13: "return",
            16: "shift",
            17: "ctrl",
            18: "alt",
            19: "pause",
            20: "capslock",
            27: "esc",
            32: "space",
            33: "pageup",
            34: "pagedown",
            35: "end",
            36: "home",
            37: "left",
            38: "up",
            39: "right",
            40: "down",
            45: "insert",
            46: "del",
            96: "0",
            97: "1",
            98: "2",
            99: "3",
            100: "4",
            101: "5",
            102: "6",
            103: "7",
            104: "8",
            105: "9",
            106: "*",
            107: "+",
            109: "-",
            110: ".",
            111: "/",
            112: "f1",
            113: "f2",
            114: "f3",
            115: "f4",
            116: "f5",
            117: "f6",
            118: "f7",
            119: "f8",
            120: "f9",
            121: "f10",
            122: "f11",
            123: "f12",
            144: "numlock",
            145: "scroll",
            191: "/",
            224: "meta"
        },
        shiftNums: {
            "`": "~",
            "1": "!",
            "2": "@",
            "3": "#",
            "4": "$",
            "5": "%",
            "6": "^",
            "7": "&",
            "8": "*",
            "9": "(",
            "0": ")",
            "-": "_",
            "=": "+",
            ";": ": ",
            "'": '"',
            ",": "<",
            ".": ">",
            "/": "?",
            "\\": "|"
        }
    };
    j.each(["keydown", "keyup", "keypress"], function() {
        j.event.special[this] = {
            add: f
        }
    })
})(jQuery);

(function(j, f) {
    function h(q) {
        j.extend(true, nb, q)
    }

    function b(q, s, t) {
        function u() {
            q.addClass("fc");
            s.isRTL ? q.addClass("fc-rtl") : q.addClass("fc-ltr");
            s.theme && q.addClass("ui-widget");
            Aa = j("<div class='fc-content' style='position:relative'/>").prependTo(q);
            W = new c(ra, s);
            (ka = W.render()) && q.prepend(ka);
            A(s.defaultView);
            if (s.handleWindowResize) {
                j(window).resize(ja);
                Qa = j(document).width();
                setTimeout(function() {
                    if (Qa != j(document).width()) {
                        Qa = j(document).width();
                        ja()
                    }
                }, 200)
            }
            j("body").is(":visible") || y()
        }

        function y() {
            setTimeout(function() {
                !ea.start &&
                    j("body").is(":visible") && L()
            }, 0)
        }

        function J() {
            return q.is(":visible")
        }

        function A(aa) {
            if (!ea || aa != ea.name) {
                oa++;
                if (ea) {
                    Ha("viewDestroy", ea, ea, ea.element);
                    Ra();
                    ea.triggerEventDestroy();
                    ga();
                    ea.element.remove();
                    W.deactivateButton(ea.name)
                }
                W.activateButton(aa);
                ea = new hb[aa](j("<div class='fc-view fc-view-" + aa + "' style='position:relative'/>").appendTo(Aa), ra);
                L();
                va();
                oa--;
                Ha("viewChange", ra, aa)
            }
        }

        function L(aa) {
            if (!ea.start || aa || ua < ea.start || ua >= ea.end) J() && R(aa)
        }

        function R(aa) {
            oa++;
            if (ea.start) {
                Ha("viewDestroy",
                    ea, ea, ea.element);
                Ra();
                X()
            }
            ga();
            ea.render(ua, aa || 0);
            D();
            va();
            (ea.afterRender || fb)();
            W.updateTitle(ea.title);
            aa = new Date;
            (aa = aa >= ea.start && aa < ea.end) ? W.disableButton("today"): W.enableButton("today");
            Ha("updateTodayButton", ia, !aa);
            Ha("viewRender", ea, ea, ea.element);
            ea.trigger("viewDisplay", ia);
            oa--;
            !s.lazyFetching || xa(ea.visStart, ea.visEnd) ? Ta(ea.visStart, ea.visEnd) : la()
        }

        function T() {
            if (J()) {
                Ra();
                X();
                ba();
                D();
                la()
            }
        }

        function ba() {
            N = s.contentHeight ? s.contentHeight : s.height ? s.height - (ka ? ka.height() : 0) -
                Wa(Aa) : Math.round(Aa.width() / Math.max(s.aspectRatio, 0.5))
        }

        function D() {
            N === f && ba();
            oa++;
            ea.setHeight(N);
            ea.setWidth(Aa.width());
            oa--;
            G = q.outerWidth()
        }

        function ja() {
            if (!oa)
                if (ea.start) {
                    var aa = ++na;
                    setTimeout(function() {
                        if (aa == na && !oa && J())
                            if (G != (G = q.outerWidth())) {
                                oa++;
                                T();
                                ea.trigger("windowResize", ia);
                                oa--
                            }
                    }, 200)
                } else y()
        }

        function pa(aa) {
            X();
            la(aa)
        }

        function la(aa) {
            if (J()) {
                var Da = j(document).height() > j(window).height();
                ea.setEventData(Ia);
                ea.renderEvents(Ia, aa);
                Ab() && j("div.fc-event").trigger("mouseover");
                ea.trigger("eventAfterAllRender");
                j(document).height() > j(window).height() != Da && T()
            }
        }

        function X() {
            ea.triggerEventDestroy();
            ea.clearEvents();
            ea.clearEventData()
        }

        function Ra() {
            ea && ea.unselect()
        }

        function ga() {
            Aa.css({
                width: "100%",
                height: Aa.height(),
                overflow: "hidden"
            })
        }

        function va() {
            Aa.css({
                width: "",
                height: "",
                overflow: ""
            })
        }

        function Ha(aa, Da) {
            if (s[aa]) return s[aa].apply(Da || ia, Array.prototype.slice.call(arguments, 2))
        }
        var ra = this;
        ra.options = s;
        ra.render = function(aa) {
            if (Aa) {
                if (J()) {
                    ba();
                    R(aa)
                }
            } else u()
        };
        ra.destroy =
            function() {
                if (ea) {
                    Ha("viewDestroy", ea, ea, ea.element);
                    ea.triggerEventDestroy()
                }
                j(window).unbind("resize", ja);
                W.destroy();
                Aa.remove();
                q.removeClass("fc fc-rtl ui-widget")
            };
        ra.refetchEvents = function() {
            X();
            Ta(ea.visStart, ea.visEnd)
        };
        ra.reportEvents = function(aa) {
            Ia = aa;
            la()
        };
        ra.reportEventChange = function(aa) {
            pa(aa)
        };
        ra.rerenderEvents = pa;
        ra.changeView = A;
        ra.select = function(aa, Da, ya) {
            ea.select(aa, Da, ya === f ? true : ya)
        };
        ra.unselect = Ra;
        ra.prev = function() {
            L(-1)
        };
        ra.next = function() {
            L(1)
        };
        ra.prevYear = function() {
            a(ua, -1);
            L()
        };
        ra.nextYear = function() {
            a(ua, 1);
            L()
        };
        ra.today = function() {
            ua = new Date;
            L()
        };
        ra.gotoDate = function(aa, Da, ya) {
            if (aa instanceof Date) ua = n(aa);
            else r(ua, aa, Da, ya);
            L()
        };
        ra.incrementDate = function(aa, Da, ya) {
            aa !== f && a(ua, aa);
            Da !== f && e(ua, Da);
            ya !== f && g(ua, ya);
            L()
        };
        ra.formatDate = function(aa, Da) {
            return ha(aa, Da, s)
        };
        ra.formatDates = function(aa, Da, ya) {
            return wa(aa, Da, ya, s)
        };
        ra.getDate = function() {
            return n(ua)
        };
        ra.getView = function() {
            return ea
        };
        ra.option = function(aa, Da) {
            if (Da === f) return s[aa];
            if (aa == "height" ||
                aa == "contentHeight" || aa == "aspectRatio") {
                s[aa] = Da;
                T()
            }
        };
        ra.trigger = Ha;
        ra.calcSize = ba;
        ra.setSize = D;
        ra.refetchSource = function(aa) {
            v(ea.visStart, ea.visEnd, aa)
        };
        d.call(ra, s, t);
        var xa = ra.isFetchNeeded,
            Ta = ra.fetchEvents,
            v = ra.refetchEventSource,
            ia = q[0],
            W, ka, Aa, ea, G, N, na = 0,
            oa = 0,
            ua = new Date,
            Ia = [],
            Ba, Qa;
        r(ua, s.year, s.month, s.date);
        s.droppable && j(document).bind("dragstart", function(aa, Da) {
            var ya = aa.target,
                V = j(ya);
            if (!V.parents(".fc").length) {
                var fa = s.dropAccept;
                if (j.isFunction(fa) ? fa.call(ya, V) : V.is(fa)) {
                    Ba =
                        ya;
                    ea.dragStart(Ba, aa, Da)
                }
            }
        }).bind("dragstop", function(aa, Da) {
            if (Ba) {
                ea.dragStop(Ba, aa, Da);
                Ba = null
            }
        })
    }

    function c(q, s) {
        function t(J) {
            var A = j("<td class='fc-header-" + J + "'/>");
            (J = s.header[J]) && j.each(J.split(" "), function(L) {
                L > 0 && A.append("<span class='fc-header-space'/>");
                var R;
                j.each(this.split(","), function(T, ba) {
                    if (ba == "title") {
                        A.append("<span class='fc-header-title'><h2>&nbsp;</h2></span>");
                        R && R.addClass(y + "-corner-right");
                        R = null
                    } else {
                        var D;
                        if (q[ba]) D = q[ba];
                        else if (hb[ba]) D = function() {
                            la.removeClass(y +
                                "-state-hover");
                            q.changeView(ba)
                        };
                        if (D) {
                            var ja = s.theme ? Oa(s.buttonIcons, ba) : null,
                                pa = Oa(s.buttonText, ba),
                                la = j("<span class='fc-button fc-button-" + ba + " " + y + "-state-default'>" + (ja ? "<span class='fc-icon-wrap'><span class='ui-icon ui-icon-" + ja + "'/></span>" : pa) + "</span>").click(function() {
                                    la.hasClass(y + "-state-disabled") || D()
                                }).mousedown(function() {
                                    la.not("." + y + "-state-active").not("." + y + "-state-disabled").addClass(y + "-state-down")
                                }).mouseup(function() {
                                    la.removeClass(y + "-state-down")
                                }).hover(function() {
                                    la.not("." +
                                        y + "-state-active").not("." + y + "-state-disabled").addClass(y + "-state-hover")
                                }, function() {
                                    la.removeClass(y + "-state-hover").removeClass(y + "-state-down")
                                }).appendTo(A);
                            gb(la);
                            R || la.addClass(y + "-corner-left");
                            R = la
                        }
                    }
                });
                R && R.addClass(y + "-corner-right")
            });
            return A
        }
        this.render = function() {
            y = s.theme ? "ui" : "fc";
            if (s.header) return u = j("<table class='fc-header' style='width:100%'/>").append(j("<tr/>").append(t("left")).append(t("center")).append(t("right")))
        };
        this.destroy = function() {
            u.remove()
        };
        this.updateTitle =
            function(J) {
                j("#current-date-title").html(J)
            };
        this.activateButton = function(J) {
            u.find("span.fc-button-" + J).addClass(y + "-state-active")
        };
        this.deactivateButton = function(J) {
            u.find("span.fc-button-" + J).removeClass(y + "-state-active")
        };
        this.disableButton = function(J) {
            u.find("span.fc-button-" + J).addClass(y + "-state-disabled")
        };
        this.enableButton = function(J) {
            u.find("span.fc-button-" + J).removeClass(y + "-state-disabled")
        };
        var u = j([]),
            y
    }

    function d(q, s) {
        function t(v, ia) {
            u(v, function(W) {
                if (ia == va) {
                    if (W) {
                        if (q.eventDataTransform) W =
                            j.map(W, q.eventDataTransform);
                        if (v.eventDataTransform) W = j.map(W, v.eventDataTransform);
                        for (var ka = 0; ka < W.length; ka++) {
                            W[ka].source = v;
                            L(W[ka])
                        }
                        xa = xa.concat(W)
                    }
                    Ha--;
                    Ha || pa(xa)
                }
            })
        }

        function u(v, ia) {
            var W, ka = $a.sourceFetchers,
                Aa;
            for (W = 0; W < ka.length; W++) {
                Aa = ka[W](v, Ra, ga, ia);
                if (Aa === true) return;
                else if (typeof Aa == "object") {
                    u(Aa, ia);
                    return
                }
            }
            if (W = v.events)
                if (j.isFunction(W)) {
                    J();
                    W(n(Ra), n(ga), function(na) {
                        ia(na);
                        A()
                    })
                } else j.isArray(W) ? ia(W) : ia();
            else if (v.url) {
                var ea = v.success,
                    G = v.error,
                    N = v.complete;
                W = j.isFunction(v.data) ?
                    v.data() : v.data;
                W = j.extend({}, W || {});
                ka = kb(v.startParam, q.startParam);
                Aa = kb(v.endParam, q.endParam);
                if (ka) W[ka] = ca(Ra);
                if (Aa) W[Aa] = ca(ga);
                J();
                j.ajax(j.extend({}, Mb, v, {
                    data: W,
                    success: function(na) {
                        na = na || [];
                        var oa = ob(ea, this, arguments);
                        if (j.isArray(oa)) na = oa;
                        ia(na)
                    },
                    error: function() {
                        ob(G, this, arguments);
                        ia()
                    },
                    complete: function() {
                        ob(N, this, arguments);
                        A()
                    }
                }))
            } else ia()
        }

        function y(v) {
            if (j.isFunction(v) || j.isArray(v)) v = {
                events: v
            };
            else if (typeof v == "string") v = {
                url: v
            };
            if (typeof v == "object") {
                R(v);
                X.push(v);
                return v
            }
        }

        function J() {
            ra++ || D("loading", null, true, ja())
        }

        function A() {
            --ra || D("loading", null, false, ja())
        }

        function L(v) {
            var ia = v.source || {},
                W = kb(ia.ignoreTimezone, q.ignoreTimezone);
            v._id = v._id || (v.id === f ? "_fc" + Nb++ : v.id + "");
            if (v.date) {
                if (!v.start) v.start = v.date;
                delete v.date
            }
            v._start = n(v.start = B(v.start, W));
            v.end = B(v.end, W);
            if (v.end && v.end <= v.start) v.end = null;
            v._end = v.end ? n(v.end) : null;
            if (v.allDay === f) v.allDay = kb(ia.allDayDefault, q.allDayDefault);
            if (v.className) {
                if (typeof v.className == "string") v.className =
                    v.className.split(/\s+/)
            } else v.className = []
        }

        function R(v) {
            if (v.className) {
                if (typeof v.className == "string") v.className = v.className.split(/\s+/)
            } else v.className = [];
            for (var ia = $a.sourceNormalizers, W = 0; W < ia.length; W++) ia[W](v)
        }

        function T(v) {
            if (j.isFunction(v) || j.isArray(v)) v = {
                events: v
            };
            else if (typeof v == "string") v = {
                url: v
            };
            if (typeof v == "object") {
                R(v);
                return v
            }
        }

        function ba(v) {
            return (typeof v == "object" ? v.events || v.url : "") || v
        }
        this.isFetchNeeded = function(v, ia) {
            return !Ra || v < Ra || ia > ga
        };
        this.fetchEvents = function(v,
            ia) {
            Ra = v;
            ga = ia;
            xa = [];
            var W = ++va,
                ka = X.length;
            Ha = ka;
            for (var Aa = 0; Aa < ka; Aa++) t(X[Aa], W)
        };
        this.addEventSource = function(v) {
            if (v = y(v)) {
                Ha++;
                t(v, va)
            }
        };
        this.removeEventSource = function(v) {
            X = j.grep(X, function(ia) {
                return !(ia && v && ba(ia) == ba(v))
            });
            xa = j.grep(xa, function(ia) {
                return !(ia.source && v && ba(ia.source) == ba(v))
            });
            pa(xa)
        };
        this.updateEvent = function(v) {
            var ia, W = xa.length,
                ka, Aa = ja().defaultEventEnd,
                ea = v.start - v._start,
                G = v.end ? v.end - (v._end || Aa(v)) : 0;
            for (ia = 0; ia < W; ia++) {
                ka = xa[ia];
                if (ka._id == v._id && ka != v) {
                    ka.start =
                        new Date(+ka.start + ea);
                    ka.end = v.end ? ka.end ? new Date(+ka.end + G) : new Date(+Aa(ka) + G) : null;
                    ka.title = v.title;
                    ka.url = v.url;
                    ka.allDay = v.allDay;
                    ka.className = v.className;
                    ka.editable = v.editable;
                    ka.color = v.color;
                    ka.backgroundColor = v.backgroundColor;
                    ka.borderColor = v.borderColor;
                    ka.textColor = v.textColor;
                    L(ka)
                }
            }
            L(v);
            pa(xa)
        };
        this.renderEvent = function(v, ia) {
            L(v);
            if (!v.source) {
                if (ia) {
                    la.events.push(v);
                    v.source = la
                }
                xa.push(v)
            }
            pa(xa)
        };
        this.removeEvents = function(v) {
            if (v) {
                if (!j.isFunction(v)) {
                    var ia = v + "";
                    v = function(ka) {
                        return ka._id ==
                            ia
                    }
                }
                xa = j.grep(xa, v, true);
                for (W = 0; W < X.length; W++)
                    if (j.isArray(X[W].events)) X[W].events = j.grep(X[W].events, v, true)
            } else {
                xa = [];
                for (var W = 0; W < X.length; W++)
                    if (j.isArray(X[W].events)) X[W].events = []
            }
            pa(xa)
        };
        this.clientEvents = function(v) {
            if (j.isFunction(v)) return j.grep(xa, v);
            else if (v) {
                v += "";
                return j.grep(xa, function(ia) {
                    return ia._id == v
                })
            }
            return xa
        };
        this.normalizeEvent = L;
        this.refetchEventSource = function(v, ia, W) {
            if (W = T(W)) {
                Ra = v;
                ga = ia;
                xa = j.grep(xa, function(ka) {
                    return !(ka.source && W && ba(ka.source) == ba(W))
                });
                pa(xa);
                Ha++;
                t(W, va)
            }
        };
        this.renderEventForSource = function(v, ia) {
            if (ia = T(ia)) {
                L(v);
                v.source = ia;
                xa.push(v)
            }
            pa(xa)
        };
        for (var D = this.trigger, ja = this.getView, pa = this.reportEvents, la = {
            events: []
        }, X = [la], Ra, ga, va = 0, Ha = 0, ra = 0, xa = [], Ta = 0; Ta < s.length; Ta++) y(s[Ta])
    }

    function a(q, s, t) {
        q.setFullYear(q.getFullYear() + s);
        t || o(q);
        return q
    }

    function e(q, s, t) {
        if (+q) {
            s = q.getMonth() + s;
            var u = n(q);
            u.setDate(1);
            u.setMonth(s);
            q.setMonth(s);
            for (t || o(q); q.getMonth() != u.getMonth();) q.setDate(q.getDate() + (q < u ? 1 : -1))
        }
        return q
    }

    function g(q,
        s, t) {
        if (+q) {
            s = q.getDate() + s;
            var u = n(q);
            u.setHours(9);
            u.setDate(s);
            q.setDate(s);
            t || o(q);
            k(q, u)
        }
        return q
    }

    function k(q, s) {
        if (+q)
            for (; q.getDate() != s.getDate();) q.setTime(+q + (q < s ? 1 : -1) * Ob)
    }

    function l(q, s) {
        q.setMinutes(q.getMinutes() + s);
        return q
    }

    function o(q) {
        q.setHours(0);
        q.setMinutes(0);
        q.setSeconds(0);
        q.setMilliseconds(0);
        return q
    }

    function n(q, s) {
        if (s) return o(new Date(+q));
        return new Date(+q)
    }

    function m() {
        var q = 0,
            s;
        do s = new Date(1970, q++, 1); while (s.getHours());
        return s
    }

    function p(q, s) {
        return Math.round((n(q,
            true) - n(s, true)) / Pb)
    }

    function r(q, s, t, u) {
        if (s !== f && s != q.getFullYear()) {
            q.setDate(1);
            q.setMonth(0);
            q.setFullYear(s)
        }
        if (t !== f && t != q.getMonth()) {
            q.setDate(1);
            q.setMonth(t)
        }
        u !== f && q.setDate(u)
    }

    function B(q, s) {
        if (typeof q == "object") return q;
        if (typeof q == "number") return new Date(q * 1E3);
        if (typeof q == "string") {
            if (q.match(/^\d+(\.\d+)?$/)) return new Date(parseFloat(q) * 1E3);
            if (s === f) s = true;
            return z(q, s) || (q ? new Date(q) : null)
        }
        return null
    }

    function ca(q) {
        q = Date.UTC(q.getFullYear(), q.getMonth(), q.getDate());
        return Math.round(+q /
            1E3)
    }

    function z(q, s) {
        var t = q.match(/^([0-9]{4})(-([0-9]{2})(-([0-9]{2})([T ]([0-9]{2}):([0-9]{2})(:([0-9]{2})(\.([0-9]+))?)?(Z|(([-+])([0-9]{2})(:?([0-9]{2}))?))?)?)?)?$/);
        if (!t) return null;
        var u = new Date(t[1], 0, 1);
        if (s || !t[13]) {
            var y = new Date(t[1], 0, 1, 9, 0);
            if (t[3]) {
                u.setMonth(t[3] - 1);
                y.setMonth(t[3] - 1)
            }
            if (t[5]) {
                u.setDate(t[5]);
                y.setDate(t[5])
            }
            k(u, y);
            t[7] && u.setHours(t[7]);
            t[8] && u.setMinutes(t[8]);
            t[10] && u.setSeconds(t[10]);
            t[12] && u.setMilliseconds(Number("0." + t[12]) * 1E3);
            k(u, y)
        } else {
            u.setUTCFullYear(t[1],
                t[3] ? t[3] - 1 : 0, t[5] || 1);
            u.setUTCHours(t[7] || 0, t[8] || 0, t[10] || 0, t[12] ? Number("0." + t[12]) * 1E3 : 0);
            if (t[14]) {
                y = Number(t[16]) * 60 + (t[18] ? Number(t[18]) : 0);
                y *= t[15] == "-" ? 1 : -1;
                u = new Date(+u + y * 60 * 1E3)
            }
        }
        return u
    }

    function S(q) {
        if (typeof q == "number") return q * 60;
        if (typeof q == "object") return q.getHours() * 60 + q.getMinutes();
        if (q = q.match(/(\d+)(?::(\d+))?\s*(\w+)?/)) {
            var s = parseInt(q[1], 10);
            if (q[3]) {
                s %= 12;
                if (q[3].toLowerCase().charAt(0) == "p") s += 12
            }
            return s * 60 + (q[2] ? parseInt(q[2], 10) : 0)
        }
    }

    function ha(q, s, t) {
        return wa(q,
            null, s, t)
    }

    function wa(q, s, t, u) {
        u = u || nb;
        var y = q,
            J = s,
            A, L = t.length,
            R, T, ba, D = "";
        for (A = 0; A < L; A++) {
            R = t.charAt(A);
            if (R == "'")
                for (T = A + 1; T < L; T++) {
                    if (t.charAt(T) == "'") {
                        if (y) {
                            D += T == A + 1 ? "'" : t.substring(A + 1, T);
                            A = T
                        }
                        break
                    }
                } else if (R == "(")
                    for (T = A + 1; T < L; T++) {
                        if (t.charAt(T) == ")") {
                            A = ha(y, t.substring(A + 1, T), u);
                            if (parseInt(A.replace(/\D/, ""), 10)) D += A;
                            A = T;
                            break
                        }
                    } else if (R == "[")
                        for (T = A + 1; T < L; T++) {
                            if (t.charAt(T) == "]") {
                                R = t.substring(A + 1, T);
                                A = ha(y, R, u);
                                if (A != ha(J, R, u)) D += A;
                                A = T;
                                break
                            }
                        } else if (R == "{") {
                            y = s;
                            J = q
                        } else if (R == "}") {
                y =
                    q;
                J = s
            } else {
                for (T = L; T > A; T--)
                    if (ba = Bb[t.substring(A, T)]) {
                        if (y) D += ba(y, u);
                        A = T - 1;
                        break
                    }
                if (T == A)
                    if (y) D += R
            }
        }
        return D
    }

    function La(q) {
        var s;
        if (q.end) {
            s = q.end;
            q = q.allDay;
            s = n(s);
            s = q || s.getHours() || s.getMinutes() ? g(s, 1) : o(s)
        } else s = g(n(q.start), 1);
        return s
    }

    function ma(q, s, t) {
        q.unbind("mouseover").mouseover(function(u) {
            for (var y = u.target, J; y != this;) {
                J = y;
                y = y.parentNode
            }
            if ((y = J._fci) !== f) {
                J._fci = f;
                J = s[y];
                t(J.event, J.element, J);
                j(u.target).trigger(u)
            }
            u.stopPropagation()
        })
    }

    function Ga(q, s, t) {
        for (var u = 0, y; u < q.length; u++) {
            y =
                j(q[u]);
            y.width(Math.max(0, s - (Ca(y) + Sa(y) + (t ? Ea(y) : 0))))
        }
    }

    function qa(q, s, t) {
        for (var u = 0, y; u < q.length; u++) {
            y = j(q[u]);
            y.height(Math.max(0, s - Wa(y, t)))
        }
    }

    function Ca(q) {
        return (parseFloat(j.css(q[0], "paddingLeft", true)) || 0) + (parseFloat(j.css(q[0], "paddingRight", true)) || 0)
    }

    function Ea(q) {
        return (parseFloat(j.css(q[0], "marginLeft", true)) || 0) + (parseFloat(j.css(q[0], "marginRight", true)) || 0)
    }

    function Sa(q) {
        return (parseFloat(j.css(q[0], "borderLeftWidth", true)) || 0) + (parseFloat(j.css(q[0], "borderRightWidth", true)) ||
            0)
    }

    function Wa(q, s) {
        return (parseFloat(j.css(q[0], "paddingTop", true)) || 0) + (parseFloat(j.css(q[0], "paddingBottom", true)) || 0) + ((parseFloat(j.css(q[0], "borderTopWidth", true)) || 0) + (parseFloat(j.css(q[0], "borderBottomWidth", true)) || 0)) + (s ? (parseFloat(j.css(q[0], "marginTop", true)) || 0) + (parseFloat(j.css(q[0], "marginBottom", true)) || 0) : 0)
    }

    function fb() {}

    function jb(q, s) {
        return q - s
    }

    function Xa(q) {
        return (q < 10 ? "0" : "") + q
    }

    function Oa(q, s) {
        if (q[s] !== f) return q[s];
        for (var t = s.split(/(?=[A-Z])/), u = t.length - 1, y; u >=
            0; u--) {
            y = q[t[u].toLowerCase()];
            if (y !== f) return y
        }
        return q[""]
    }

    function Pa(q) {
        return q.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#039;").replace(/"/g, "&quot;").replace(/\n/g, "<br />")
    }

    function gb(q) {
        q.attr("unselectable", "on").css("MozUserSelect", "none").bind("selectstart.ui", function() {
            return false
        })
    }

    function pb(q) {
        q.children().removeClass("fc-first fc-last").filter(":first-child").addClass("fc-first").end().filter(":last-child").addClass("fc-last")
    }

    function Cb(q,
        s) {
        var t = q.source || {},
            u = q.color,
            y = t.color,
            J = s("eventColor"),
            A = q.backgroundColor || u || t.backgroundColor || y || s("eventBackgroundColor") || J;
        u = q.borderColor || u || t.borderColor || y || s("eventBorderColor") || J;
        t = q.textColor || t.textColor || s("eventTextColor");
        y = [];
        A && y.push("background-color:" + A);
        u && y.push("border-color:" + u);
        t && y.push("color:" + t);
        return y.join(";")
    }

    function ob(q, s, t) {
        if (j.isFunction(q)) q = [q];
        if (q) {
            var u, y;
            for (u = 0; u < q.length; u++) y = q[u].apply(s, t) || y;
            return y
        }
    }

    function kb() {
        for (var q = 0; q < arguments.length; q++)
            if (arguments[q] !==
                f) return arguments[q]
    }

    function Qb(q, s, t) {
        var u = this;
        u.renderList = function(D, ja, pa) {
            R = D;
            T = ja;
            showNumbers = pa;
            y("theme");
            y("columnFormat");
            y("weekNumbers");
            y("weekNumberShortTitle");
            y("weekNumberTitle");
            y("weekNumberCalculation");
            ba = [];
            q.find(".fc-list-day").remove();
            D = j("<ul class='fc-list-day'></ul>").appendTo(q);
            ja = o(new Date);
            for (pa = 0; pa < T; pa++) {
                date = A(0, pa);
                var la = j("<li class='fc-list-day-item' data-date='" + L(date, "yyyy-MM-dd") + "'></li>").appendTo(D);
                if (+date == +ja) la.addClass("fc-today");
                else +date <
                    +ja && la.addClass("fc-past");
                la = j("<div class='fc-day-content'></div>").appendTo(la);
                J("dayRender", u, date, la);
                ba.push(la)
            }
        };
        u.setHeight = function() {};
        u.setWidth = function() {};
        u.renderDayOverlay = function() {};
        u.defaultSelectionEnd = function() {};
        u.renderSelection = function() {};
        u.clearSelection = function() {};
        u.reportDayClick = function() {};
        u.dragStart = function() {};
        u.dragStop = function() {};
        u.defaultEventEnd = function(D) {
            return n(D.start)
        };
        u.getHoverListener = function() {
            return hoverListener
        };
        u.colLeft = function() {
            return null
        };
        u.colRight = function() {
            return null
        };
        u.colContentLeft = function() {
            return null
        };
        u.colContentRight = function() {
            return null
        };
        u.getIsCellAllDay = function() {
            return true
        };
        u.allDayRow = function() {
            return null
        };
        u.getRowCnt = function() {
            return R
        };
        u.getColCnt = function() {
            return T
        };
        u.getColWidth = function() {
            return colWidth
        };
        u.getDayItems = function() {
            return ba
        };
        tb.call(u, q, s, t);
        ub.call(u);
        Rb.call(u);
        var y = u.opt,
            J = u.trigger,
            A = u.cellToDate,
            L = s.formatDate,
            R, T, ba = []
    }

    function Rb() {
        var q = this;
        q.renderEvents = function(s) {
            for (var t =
                q.getColCnt(), u = q.getDayItems(), y = 0; y < t; y++) {
                date = q.cellToDate(0, y);
                for (var J = [], A = [], L = 0; L < s.length; L++) {
                    var R = s[L];
                    !R.allDay && p(date, R.start) === 0 && J.push(R);
                    R.allDay && (R.start <= date && R.end >= date || p(date, R.start) === 0) && A.push(R)
                }
                A.sort(qb);
                J.sort(qb);
                J = A.concat(J);
                A = u[y];
                A.find(".fc-list-event").remove();
                if (J.length > 0) {
                    L = j("<ul class='fc-list-event'></ul>").appendTo(A);
                    for (R = 0; R < J.length; R++) {
                        var T = j("<li/>").addClass("fc-list-event-item").append(j("<div class='fc-event-inner'></div>"));
                        q.trigger("eventRender",
                            J[R], J[R], T);
                        L.append(T)
                    }
                }
                A.parents(".fc-list-day-item:first").toggleClass("fc-day-empty", J.length === 0)
            }
        };
        q.clearEvents = function() {}
    }

    function vb(q, s, t) {
        function u() {
            var w = "<table class='fc-border-separate' style='width:100%' cellspacing='0'>" + y() + J() + "</table>",
                C;
            xa && xa.remove();
            xa = j(w).appendTo(q);
            Ta = xa.find("thead");
            v = Ta.find(".fc-day-header");
            ia = xa.find("tbody");
            W = ia.find("tr");
            ka = ia.find(".fc-day");
            Aa = W.find("td:first-child");
            bodyWeekNumberLinks = ia.find(".fc-week-number-link");
            ea = W.eq(0).find(".fc-day > div");
            G = W.eq(0).find(".fc-day-content > div");
            pb(Ta.add(Ta.find("tr")));
            pb(W);
            W.eq(0).addClass("fc-first");
            W.filter(":last").addClass("fc-last");
            ka.each(function(E, O) {
                var P = ga(Math.floor(E / Qa), E % Qa);
                C = j(O);
                pa("dayRender", D, P, C);
                C.find(".fc-day-number:first").mousedown(L)
            });
            bodyWeekNumberLinks.click(R);
            ka.click(A).mousedown(Ra)
        }

        function y() {
            var w = F + "-widget-header",
                C = "",
                E, O;
            C += "<thead><tr>";
            if (H) C += "<th class='fc-week-number " + w + "'>" + Pa(M) + "</th>";
            for (E = 0; E < Qa; E++) {
                O = ga(0, E);
                C += "<th class='fc-day-header fc-" +
                    rb[O.getDay()] + " " + w + "'>" + Pa(ra(O, Q)) + "</th>"
            }
            C += "</tr></thead>";
            return C
        }

        function J() {
            var w = F + "-widget-content",
                C = "",
                E, O, P;
            C += "<tbody>";
            for (E = 0; E < Ba; E++) {
                C += "<tr class='fc-week'>";
                if (H) {
                    O = P = ga(E, 0);
                    if (O.getFullYear() < D.start.getFullYear()) O = new Date(D.start.getFullYear(), 0, 1);
                    if (O.getMonth() < D.start.getMonth()) O = new Date(D.start.getFullYear(), D.start.getMonth(), 1);
                    C += "<td class='fc-week-number " + w + "'><div><a class='fc-week-number-link' href='javascript:void(0);' data-date='" + ra(O, "yyyy-MM-dd") + "'>" +
                        Pa(ra(P, I)) + "</a></div></td>"
                }
                for (O = 0; O < Qa; O++) {
                    P = ga(E, O);
                    var Z = F + "-widget-content",
                        sa = D.start.getMonth(),
                        Fa = o(new Date),
                        ta = "";
                    Z = ["fc-day", "fc-" + rb[P.getDay()], Z];
                    P.getMonth() != sa && Z.push("fc-other-month");
                    if (+P == +Fa) Z.push("fc-today", F + "-state-highlight");
                    else P < Fa ? Z.push("fc-past") : Z.push("fc-future");
                    ta += "<td class='" + Z.join(" ") + "' data-date='" + ra(P, "yyyy-MM-dd") + "'><div>";
                    if (aa) ta += "<a class='fc-day-number' href='javascript:void(0);'>" + P.getDate() + "</a>";
                    ta += "<div class='fc-day-content'><div style='position:relative'>&nbsp;</div></div></div></td>";
                    C += ta
                }
                C += "</tr>"
            }
            C += "</tbody>";
            return C
        }

        function A(w) {
            if (!ja("selectable")) {
                var C = z(j(this).data("date"));
                pa("dayClick", this, C, true, w)
            }
        }

        function L() {
            var w = j(this).parents(".fc-day:first").data("date");
            s.gotoDate(z(w));
            s.changeView("agendaDay")
        }

        function R() {
            var w = j(this).data("date");
            s.gotoDate(z(w));
            s.changeView("agendaWeek")
        }

        function T(w, C, E) {
            E && Da.build();
            w = Ha(w, C);
            for (C = 0; C < w.length; C++) {
                E = w[C];
                ba(E.row, E.leftCol, E.row, E.rightCol).click(A).mousedown(Ra)
            }
        }

        function ba(w, C, E, O) {
            w = Da.rect(w, C, E, O,
                q);
            return la(w, q)
        }
        var D = this;
        D.renderBasic = function(w, C, E) {
            Ba = w;
            Qa = C;
            aa = E;
            F = ja("theme") ? "ui" : "fc";
            Q = ja("columnFormat");
            H = ja("weekNumbers");
            M = ja("weekNumberShortTitle");
            ja("weekNumberTitle");
            I = ja("weekNumberCalculation") != "iso" ? "w" : "W";
            ia || (N = j("<div class='fc-event-container' style='position:absolute;z-index:8;top:0;left:0'/>").appendTo(q));
            u()
        };
        D.setHeight = function(w) {
            oa = w;
            w = oa - Ta.height();
            var C, E, O;
            if (ja("weekMode") == "variable") C = E = Math.floor(w / (Ba == 1 ? 2 : 6));
            else {
                C = Math.floor(w / Ba);
                E = w - C * (Ba - 1)
            }
            Aa.each(function(P,
                Z) {
                if (P < Ba) {
                    O = j(Z);
                    O.find("> div").css("min-height", (P == Ba - 1 ? E : C) - Wa(O))
                }
            })
        };
        D.setWidth = function(w) {
            na = w;
            V.clear();
            fa.clear();
            Ia = 0;
            if (H) Ia = Ta.find("th.fc-week-number").outerWidth();
            ua = Math.floor((na - Ia) / Qa);
            Ga(v.slice(0, -1), ua)
        };
        D.renderDayOverlay = T;
        D.defaultSelectionEnd = function(w) {
            return n(w)
        };
        D.renderSelection = function(w, C) {
            T(w, g(n(C), 1), true)
        };
        D.clearSelection = function() {
            X()
        };
        D.reportDayClick = function(w, C, E) {
            var O = va(w);
            pa("dayClick", ka[O.row * Qa + O.col], w, C, E)
        };
        D.dragStart = function(w, C) {
            ya.start(function(E) {
                X();
                E && ba(E.row, E.col, E.row, E.col)
            }, C)
        };
        D.dragStop = function(w, C, E) {
            var O = ya.stop();
            X();
            if (O) {
                O = ga(O);
                pa("drop", w, O, true, C, E)
            }
        };
        D.defaultEventEnd = function(w) {
            return n(w.start)
        };
        D.getHoverListener = function() {
            return ya
        };
        D.colLeft = function(w) {
            return V.left(w)
        };
        D.colRight = function(w) {
            return V.right(w)
        };
        D.colContentLeft = function(w) {
            return fa.left(w)
        };
        D.colContentRight = function(w) {
            return fa.right(w)
        };
        D.getIsCellAllDay = function() {
            return true
        };
        D.allDayRow = function(w) {
            return W.eq(w)
        };
        D.getRowCnt = function() {
            return Ba
        };
        D.getColCnt = function() {
            return Qa
        };
        D.getColWidth = function() {
            return ua
        };
        D.getDaySegmentContainer = function() {
            return N
        };
        tb.call(D, q, s, t);
        Db.call(D);
        ub.call(D);
        Sb.call(D);
        var ja = D.opt,
            pa = D.trigger,
            la = D.renderOverlay,
            X = D.clearOverlays,
            Ra = D.daySelectionMousedown,
            ga = D.cellToDate,
            va = D.dateToCell,
            Ha = D.rangeToSegments,
            ra = s.formatDate,
            xa, Ta, v, ia, W, ka, Aa, ea, G, N, na, oa, ua, Ia, Ba, Qa, aa, Da, ya, V, fa, F, Q, H, M, I;
        gb(q.addClass("fc-grid"));
        Da = new Eb(function(w, C) {
            var E, O, P;
            v.each(function(Z, sa) {
                E = j(sa);
                O = E.offset().left;
                if (Z) P[1] = O;
                P = [O];
                C[Z] = P
            });
            P[1] = O + E.outerWidth();
            W.each(function(Z, sa) {
                if (Z < Ba) {
                    E = j(sa);
                    O = E.offset().top;
                    if (Z) P[1] = O;
                    P = [O];
                    w[Z] = P
                }
            });
            P[1] = O + E.outerHeight()
        });
        ya = new Fb(Da);
        V = new sb(function(w) {
            return ea.eq(w)
        });
        fa = new sb(function(w) {
            return G.eq(w)
        })
    }

    function Sb() {
        var q = this;
        q.renderEvents = function(s, t) {
            q.renderDayEvents(s, t)
        };
        q.clearEvents = function() {
            q.getDaySegmentContainer().empty()
        };
        Gb.call(q)
    }

    function Hb(q, s, t) {
        function u() {
            var K = Ya + "-widget-header",
                Y, U = "",
                da, Ma = o(new Date);
            U += "<thead><tr>";
            if (Ib) {
                Y =
                    ka(0, 0);
                Y = G(Y, Jb);
                if (db) Y += wb;
                else Y = wb + " " + Y;
                U += "<th class='fc-agenda-axis fc-week-number " + K + "'>" + Pa(Y) + "</th>"
            } else U += "<th class='fc-agenda-axis " + K + "'>&nbsp;</th>";
            var Na = za > 1;
            for (da = 0; da < za; da++) {
                Y = ka(0, da);
                var Ua = +Y == +Ma;
                if (Ua && Na) U += "<th style='width: 1px; position: relative; z-index: 3;' class='fc-state-hightlight-border'></th>";
                U += "<th class='fc-" + rb[Y.getDay()] + " fc-col" + da + " " + K;
                if (Ua && Na) U += " " + Ya + "-state-highlight fc-today";
                U += "'>";
                U += Na ? "<a class='fc-day-number' href='javascript:void(0);' data-date='" +
                    G(Y, "yyyy-MM-dd") + "'>" + Pa(G(Y, xb)) + "</a>" : Pa(G(Y, xb));
                U += "</th>";
                if (Ua && Na) U += "<th style='width: 1px; position: relative; z-index: 3;' class='fc-state-hightlight-border'></th>"
            }
            U += "<th class='fc-agenda-gutter " + K + "'>&nbsp;</th></tr></thead>";
            K = "<table style='width:100%' class='fc-agenda-days fc-border-separate' cellspacing='0'>" + U;
            da = Ya + "-widget-header";
            U = Ya + "-widget-content";
            var ab;
            Ma = o(new Date);
            var eb;
            Y = "";
            Y += "<tbody><tr><th class='fc-agenda-axis " + da + "'>&nbsp;</th>";
            Na = "";
            Ua = za > 1;
            for (da = 0; da <
                za; da++) {
                ab = ka(0, da);
                var lb = +ab == +Ma;
                eb = ["fc-col" + da, "fc-" + rb[ab.getDay()], U];
                if (lb && Ua) eb.push(Ya + "-state-highlight", "fc-today");
                else ab < Ma ? eb.push("fc-past") : eb.push("fc-future");
                ab = "<td class='" + eb.join(" ") + "'";
                if (lb && Ua) ab += "style='border-width: 0px !important; border-bottom-width: 1px !important;'";
                ab += " ><div><div class='fc-day-content'><div style='position:relative'>&nbsp;</div></div></div></td>";
                if (lb && Ua) ab = "<td style='position: relative; z-index: 3; width: 1px;' class='fc-state-hightlight-border'></td>" +
                    ab + "<td style='position: relative; z-index: 3; width: 1px;' class='fc-state-hightlight-border'></td>";
                Na += ab
            }
            Y += Na;
            Y += "<td class='fc-agenda-gutter " + U + "'>&nbsp;</td></tr></tbody>";
            K = K + Y + "</table>";
            N && N.remove();
            N = j(K).appendTo(q);
            na = N.find("thead");
            oa = na.find("th:not(.fc-state-hightlight-border)").slice(1, -1);
            ua = N.find("tbody");
            Ia = ua.find("td:not(.fc-state-hightlight-border)").slice(0, -1);
            Ba = Ia.find("> div");
            Qa = Ia.find(".fc-day-content > div");
            aa = Ia.eq(0);
            Da = Ba.eq(0);
            pb(na.add(na.find("tr")));
            pb(ua.add(ua.find("tr")));
            oa.find(".fc-day-number").click(A)
        }

        function y() {
            function K() {
                Q.scrollTop(da)
            }
            var Y = m(),
                U = n(Y);
            U.setHours(va("firstHour"));
            var da = ja(Y, U) + 1;
            K();
            setTimeout(K, 0)
        }

        function J(K) {
            if (!va("selectable")) {
                var Y = Math.min(za - 1, Math.floor((K.pageX - N.offset().left - E) / O)),
                    U = ka(0, Y),
                    da = this.parentNode.className.match(/fc-slot(\d+)/);
                if (da) {
                    da = parseInt(da[1]) * va("slotMinutes");
                    U.setHours(Math.floor(da / 60));
                    U.setMinutes(da % 60 + mb);
                    Ha("dayClick", Ia[Y], U, false, K)
                } else Ha("dayClick", Ia[Y], U, true, K)
            }
        }

        function A() {
            var K =
                j(this).data("date");
            s.gotoDate(z(K));
            s.changeView("agendaDay")
        }

        function L(K, Y, U) {
            U && Ka.build();
            K = ea(K, Y);
            for (Y = 0; Y < K.length; Y++) {
                U = K[Y];
                R(U.row, U.leftCol, U.row, U.rightCol).click(J).mousedown(ia)
            }
        }

        function R(K, Y, U, da) {
            K = Ka.rect(K, Y, U, da, ya);
            return ra(K, ya)
        }

        function T(K, Y) {
            for (var U = 0; U < za; U++) {
                var da = ka(0, U),
                    Ma = g(n(da), 1),
                    Na = new Date(Math.max(da, K)),
                    Ua = new Date(Math.min(Ma, Y));
                if (Na < Ua) {
                    Ma = Ka.rect(0, U, 0, U, H);
                    Na = ja(da, Na);
                    da = ja(da, Ua);
                    Ma.top = Na;
                    Ma.height = da - Na;
                    ra(Ma, H).click(J).mousedown(X)
                }
            }
        }

        function ba(K) {
            return va("allDaySlot") &&
                !K.row
        }

        function D(K) {
            var Y = ka(0, K.col);
            K = K.row;
            va("allDaySlot") && K--;
            l(Y, ga.minVisibleHour * 60);
            K >= 0 && l(Y, K * sa);
            return Y
        }

        function ja(K, Y) {
            K = n(K, true);
            if (Y < l(n(K), mb)) return 0;
            if (Y >= l(n(K), (ga.maxVisibleHour + 1) * 60)) return I.height();
            var U = va("slotMinutes"),
                da = Y.getHours() * 60 + Y.getMinutes() - mb,
                Ma = Math.floor(da / U),
                Na = bb[Ma];
            if (Na === f) Na = bb[Ma] = I.find("tr").eq(Ma).find("td div")[0].offsetTop;
            return Math.max(0, Math.round(Na - 1 + Z * (da % U / U)))
        }

        function pa(K, Y) {
            var U = va("selectHelper");
            Ka.build();
            if (U) {
                var da =
                    Aa(K).col;
                if (da >= 0 && da < za) {
                    da = Ka.rect(0, da, 0, da, H);
                    var Ma = ja(K, K),
                        Na = ja(K, Y);
                    if (Na > Ma) {
                        da.top = Ma;
                        da.height = Na - Ma;
                        da.left += 2;
                        da.width -= 5;
                        if (j.isFunction(U)) {
                            if (U = U(K, Y)) {
                                da.position = "absolute";
                                w = j(U).css(da).appendTo(H)
                            }
                        } else {
                            da.isStart = true;
                            da.isEnd = true;
                            w = j(W({
                                title: "",
                                start: K,
                                end: Y,
                                className: ["fc-select-helper"],
                                editable: false
                            }, da));
                            w.css("opacity", va("dragOpacity"))
                        } if (w) {
                            w.click(J).mousedown(X);
                            H.append(w);
                            Ga(w, da.width, true);
                            qa(w, da.height, true)
                        }
                    }
                }
            } else T(K, Y)
        }

        function la() {
            xa();
            if (w) {
                w.remove();
                w = null
            }
        }

        function X(K) {
            if (K.which == 1 && va("selectable")) {
                v(K);
                var Y;
                Za.start(function(U, da) {
                    la();
                    if (U && U.col == da.col && !ba(U)) {
                        var Ma = D(da),
                            Na = D(U);
                        Y = [Ma, l(n(Ma), sa), Na, l(n(Na), sa)].sort(jb);
                        pa(Y[0], Y[3])
                    } else Y = null
                }, K);
                j(document).one("mouseup", function(U) {
                    Za.stop();
                    if (Y) {
                        +Y[0] == +Y[1] && Ra(Y[0], false, U);
                        Ta(Y[0], Y[3], false, U)
                    }
                })
            }
        }

        function Ra(K, Y, U) {
            Ha("dayClick", Ia[Aa(K).col], K, Y, U)
        }
        var ga = this;
        ga.renderAgenda = function(K) {
            za = K;
            Ya = va("theme") ? "ui" : "fc";
            db = va("isRTL");
            mb = S(va("minTime"));
            yb = S(va("maxTime"));
            xb = va("columnFormat");
            Ib = va("weekNumbers");
            wb = va("weekNumberTitle");
            va("weekNumberShortTitle");
            Jb = va("weekNumberCalculation") != "iso" ? "w" : "W";
            sa = va("snapMinutes") || va("slotMinutes");
            if (N) u();
            else {
                K = Ya + "-widget-header";
                var Y = Ya + "-widget-content",
                    U, da, Ma, Na, Ua, ab = va("slotMinutes") % 15 == 0;
                u();
                ya = j("<div style='position:absolute; left:0; width:100%'/>").appendTo(q);
                if (va("allDaySlot")) {
                    V = j("<div class='fc-event-container' style='position:absolute; z-index:8; top:0; left:0'/>").appendTo(ya);
                    U = "<table style='width:100%' class='fc-agenda-allday' cellspacing='0'><tr><th class='" +
                        K + " fc-agenda-axis'>" + va("allDayText") + "</th><td><div class='fc-day-content'><div style='position:relative'/></div></td><th class='" + K + " fc-agenda-gutter'>&nbsp;</th></tr></table>";
                    fa = j(U).appendTo(ya);
                    F = fa.find("tr");
                    F.find("td").click(J).mousedown(ia);
                    ya.append("<div class='fc-agenda-divider " + K + "'><div class='fc-agenda-divider-inner'/></div>")
                } else V = j([]);
                Q = j("<div style='position:absolute;width:100%;overflow-x:hidden;overflow-y:auto'/>").appendTo(ya);
                H = j("<div style='position:relative;width:100%;overflow:hidden'/>").appendTo(Q);
                M = j("<div class='fc-event-container' style='position:absolute;z-index:8;top:0;left:0'/>").appendTo(H);
                U = "<table class='fc-agenda-slots' style='width:100%' cellspacing='0'><tbody>";
                da = m();
                Na = l(n(da), yb);
                l(da, mb);
                for (Ma = Ja = 0; da < Na; Ma++) {
                    Ua = da.getMinutes();
                    U += "<tr class='fc-slot" + Ma + " " + (!Ua ? "" : "fc-minor") + "'><th class='fc-agenda-axis " + K + "'>" + (!ab || !Ua ? G(da, va("axisFormat")) : "&nbsp;") + "</th><td class='" + Y + "'><div style='position:relative'>&nbsp;</div></td></tr>";
                    l(da, va("slotMinutes"));
                    Ja++
                }
                U += "</tbody></table>";
                I = j(U).appendTo(H);
                I.find("td").click(J).mousedown(X)
            }
        };
        ga.setWidth = function() {
            cb.clear();
            Va.clear();
            var K = na.find("th:first");
            if (fa) K = K.add(fa.find("th:first"));
            K = K.add(I.find("th").filter(":visible:first"));
            E = 0;
            Ga(K.width("").each(function(U, da) {
                E = Math.max(E, j(da).outerWidth())
            }), E);
            K = N.find(".fc-agenda-gutter");
            if (fa) K = K.add(fa.find("th.fc-agenda-gutter"));
            var Y = Q[0].clientWidth;
            if (P = Q.width() - Y) {
                Ga(K, P);
                K.show().prev().removeClass("fc-last")
            } else K.hide().prev().addClass("fc-last");
            O = Math.floor((Y -
                E) / za);
            Ga(oa.slice(0, -1), O)
        };
        ga.setHeight = function(K) {
            if (K === f) K = C;
            C = K;
            bb = {};
            var Y = ua.position().top,
                U = Q.position().top;
            K = Math.min(K - Y, I.height() + U + 1);
            Da.height(K - Wa(aa));
            ya.css("top", Y);
            Q.height(K - U - 1);
            Z = I.find("tr:visible:first").height();
            Fa = va("slotMinutes") / sa;
            ta = Z / Fa
        };
        ga.afterRender = function() {
            y()
        };
        ga.defaultEventEnd = function(K) {
            var Y = n(K.start);
            if (K.allDay) return Y;
            return l(Y, va("defaultEventMinutes"))
        };
        ga.timePosition = ja;
        ga.getIsCellAllDay = ba;
        ga.allDayRow = function() {
            return F
        };
        ga.getCoordinateGrid =
            function() {
                return Ka
            };
        ga.getHoverListener = function() {
            return Za
        };
        ga.colLeft = function(K) {
            return cb.left(K)
        };
        ga.colRight = function(K) {
            return cb.right(K)
        };
        ga.colContentLeft = function(K) {
            return Va.left(K)
        };
        ga.colContentRight = function(K) {
            return Va.right(K)
        };
        ga.getDaySegmentContainer = function() {
            return V
        };
        ga.getSlotSegmentContainer = function() {
            return M
        };
        ga.getMinMinute = function() {
            return mb
        };
        ga.getMaxMinute = function() {
            return yb
        };
        ga.getSlotContainer = function() {
            return H
        };
        ga.getRowCnt = function() {
            return 1
        };
        ga.getColCnt =
            function() {
                return za
            };
        ga.getColWidth = function() {
            return O
        };
        ga.getSnapHeight = function() {
            return ta
        };
        ga.getSnapMinutes = function() {
            return sa
        };
        ga.defaultSelectionEnd = function(K, Y) {
            if (Y) return n(K);
            return l(n(K), va("slotMinutes"))
        };
        ga.renderDayOverlay = L;
        ga.renderSelection = function(K, Y, U) {
            if (U) va("allDaySlot") && L(K, g(n(Y), 1), true);
            else pa(K, Y)
        };
        ga.clearSelection = la;
        ga.reportDayClick = Ra;
        ga.dragStart = function(K, Y) {
            Za.start(function(U) {
                xa();
                if (U)
                    if (ba(U)) R(U.row, U.col, U.row, U.col);
                    else {
                        U = D(U);
                        var da = l(n(U),
                            va("defaultEventMinutes"));
                        T(U, da)
                    }
            }, Y)
        };
        ga.dragStop = function(K, Y, U) {
            var da = Za.stop();
            xa();
            da && Ha("drop", K, D(da), ba(da), Y, U)
        };
        tb.call(ga, q, s, t);
        Db.call(ga);
        ub.call(ga);
        Tb.call(ga);
        var va = ga.opt,
            Ha = ga.trigger,
            ra = ga.renderOverlay,
            xa = ga.clearOverlays,
            Ta = ga.reportSelection,
            v = ga.unselect,
            ia = ga.daySelectionMousedown,
            W = ga.slotSegHtml,
            ka = ga.cellToDate,
            Aa = ga.dateToCell,
            ea = ga.rangeToSegments,
            G = s.formatDate,
            N, na, oa, ua, Ia, Ba, Qa, aa, Da, ya, V, fa, F, Q, H, M, I, w, C, E, O, P, Z, sa, Fa, ta, za, Ja, Ka, Za, cb, Va, bb = {},
            Ya, db, mb, yb,
            xb, Ib, wb, Jb;
        gb(q.addClass("fc-agenda"));
        Ka = new Eb(function(K, Y) {
            var U, da, Ma;
            oa.each(function(lb, Ub) {
                U = j(Ub);
                da = U.offset().left;
                if (lb) Ma[1] = da;
                Ma = [da];
                Y[lb] = Ma
            });
            Ma[1] = da + U.outerWidth();
            if (va("allDaySlot")) {
                U = F;
                da = U.offset().top;
                K[0] = [da, da + U.outerHeight()]
            }
            for (var Na = H.offset().top, Ua = Q.offset().top, ab = Ua + Q.outerHeight(), eb = 0; eb < Ja * Fa; eb++) K.push([Math.max(Ua, Math.min(ab, Na + ta * eb)), Math.max(Ua, Math.min(ab, Na + ta * (eb + 1)))])
        });
        Za = new Fb(Ka);
        cb = new sb(function(K) {
            return Ba.eq(K)
        });
        Va = new sb(function(K) {
            return Qa.eq(K)
        })
    }

    function Tb() {
        function q(V) {
            var fa = L("minDefaultDayStartHour"),
                F = L("maxDefaultDayEndHour");
            V && j.each(V, function(H, M) {
                var I = M.start.getHours(),
                    w = M.end.getHours();
                if (fa > I) fa = I;
                if (F < w) F = w
            });
            A.minVisibleHour = fa;
            A.maxVisibleHour = F;
            V = "";
            for (var Q = 0; Q < fa * 2; Q++) {
                if (V.length) V += ", ";
                V += "tr.fc-slot" + Q
            }
            for (Q = F * 2 + 2; Q < 48; Q++) {
                if (V.length) V += ", ";
                V += "tr.fc-slot" + Q
            }
            j(".fc-agenda-slots tr").show();
            j(V).hide();
            aa.calcSize();
            aa.setSize()
        }

        function s(V) {
            return V.end ? n(V.end) : l(n(V.start), L("defaultEventMinutes"))
        }

        function t(V,
            fa) {
            var F = "<",
                Q = V.url,
                H = Cb(V, L),
                M = ["fc-event", "fc-event-vert"];
            T(V) && M.push("fc-event-draggable");
            fa.isStart && M.push("fc-event-start");
            fa.isEnd && M.push("fc-event-end");
            M = M.concat(V.className);
            if (V.source) M = M.concat(V.source.className || []);
            F += Q ? "a href='" + Pa(V.url) + "'" : "div";
            var I = L("timeFormat");
            if (aa.getView().name === "agendaWeek") I = aa.option("timeFormat")[""];
            F += " class='" + M.join(" ") + "' style='position:absolute;top:" + fa.top + "px;left:" + fa.left + "px;" + H + "'><div class='fc-event-inner'><span class='fc-event-time'>" +
                Pa(ya(V.start, V.end, I)) + "</span><span class='fc-event-title'>" + Pa(V.title || "") + "</span></div><div class='fc-event-bg'></div>";
            if (fa.isEnd && ba(V)) F += "<div class='ui-resizable-handle ui-resizable-s'>=</div>";
            F += "</" + (Q ? "a" : "div") + ">";
            return F
        }

        function u(V, fa, F) {
            var Q = fa.find("div.fc-event-time");
            T(V) && y(V, fa, Q);
            F.isEnd && ba(V) && J(V, fa, Q);
            ja(V, fa)
        }

        function y(V, fa, F) {
            function Q() {
                Ba();
                if (P)
                    if (cb && sa) {
                        F.hide();
                        fa.draggable("option", "grid", null);
                        Ia(g(n(V.start), Ja), g(La(V), Ja))
                    } else {
                        var Va = Ka,
                            bb = l(n(V.start),
                                Va),
                            Ya;
                        if (V.end) Ya = l(n(V.end), Va);
                        F.text(ya(bb, Ya, L("timeFormat")));
                        F.css("display", "");
                        fa.draggable("option", "grid", [I, w])
                    }
            }
            var H = A.getCoordinateGrid(),
                M = ia(),
                I = W(),
                w = ka(),
                C = Aa(),
                E, O, P, Z, sa, Fa, ta, za, Ja, Ka, Za, cb = L("dragBetweenAllDayAndSlots");
            fa.draggable({
                scroll: false,
                grid: [I, w],
                axis: M == 1 ? "y" : false,
                opacity: L("dragOpacity"),
                revertDuration: L("dragRevertDuration"),
                start: function(Va, bb) {
                    R("eventDragStart", fa, V, Va, bb);
                    na(V, fa);
                    H.build();
                    E = fa.position();
                    O = H.cell(Va.pageX, Va.pageY);
                    P = Z = true;
                    sa = Fa = ra(O);
                    Ka = Za = Ja = ta = za = 0
                },
                drag: function(Va, bb) {
                    var Ya = H.cell(Va.pageX, Va.pageY);
                    if (P = !!Ya) {
                        sa = ra(Ya);
                        if (cb || !sa) {
                            ta = Math.round((bb.position.left - E.left) / I);
                            if (ta != za) {
                                Ya = v(0, O.col);
                                var db = O.col + ta;
                                db = Math.max(0, db);
                                db = Math.min(M - 1, db);
                                db = v(0, db);
                                Ja = p(db, Ya)
                            }
                        } else P = false;
                        sa || (Ka = Math.round((bb.position.top - E.top) / w) * C)
                    }
                    if (P != Z || sa != Fa || ta != za || Ka != Za) {
                        Q();
                        Z = P;
                        Fa = sa;
                        za = ta;
                        Za = Ka
                    }
                    fa.draggable("option", "revert", !P)
                },
                stop: function(Va, bb) {
                    Ba();
                    R("eventDragStop", fa, V, Va, bb);
                    if (P && (sa || Ja || Ka)) oa(this, V, Ja, sa ? 0 :
                        Ka, sa, Va, bb);
                    else {
                        P = true;
                        sa = false;
                        Ka = Ja = ta = 0;
                        Q();
                        fa.css("filter", "");
                        fa.css(E);
                        N(V, fa)
                    }
                }
            })
        }

        function J(V, fa, F) {
            var Q, H, M = ka(),
                I = Aa();
            fa.resizable({
                minHeight: M * L("minHeightInSlots"),
                handles: {
                    s: ".ui-resizable-handle"
                },
                grid: M,
                start: function(w, C) {
                    Q = H = 0;
                    na(V, fa);
                    R("eventResizeStart", this, V, w, C)
                },
                resize: function(w, C) {
                    Q = Math.round((Math.max(M, fa.height()) - C.originalSize.height) / M);
                    if (Q != H) {
                        F.text(ya(V.start, !Q && !V.end ? null : l(D(V), I * Q), L("timeFormat")));
                        H = Q
                    }
                },
                stop: function(w, C) {
                    R("eventResizeStop", this, V,
                        w, C);
                    Q ? ua(this, V, 0, I * Q, w, C) : N(V, fa)
                }
            })
        }
        var A = this;
        A.renderEvents = function(V, fa) {
            var F, Q = V.length,
                H = [],
                M = [],
                I = j(".fc-agenda-allday, .fc-agenda-divider.fc-widget-header");
            for (F = 0; F < Q; F++) {
                var w = V[F];
                if (w.allDay) {
                    if (w.start >= A.start && w.start <= A.end || w.end >= A.start && w.end <= A.end || w.start < A.start && w.end > A.end) H.push(w)
                } else M.push(w)
            }
            if (L("allDaySlot")) {
                if (H.length > 0) {
                    I.show();
                    Qa(H, fa)
                } else {
                    Qa(H, fa);
                    I.hide()
                }
                pa()
            }
            Q = ia();
            H = va();
            I = ga();
            var C;
            w = j.map(M, s);
            var E, O, P, Z;
            F = [];
            for (E = 0; E < Q; E++) {
                C = v(0, E);
                l(C, H);
                O = M;
                P = w;
                Z = C;
                C = l(n(C), I - H);
                var sa = [],
                    Fa = void 0,
                    ta = O.length,
                    za = void 0,
                    Ja = void 0,
                    Ka = void 0,
                    Za = void 0,
                    cb = void 0;
                for (Fa = 0; Fa < ta; Fa++) {
                    za = O[Fa];
                    Ja = za.start;
                    Ka = P[Fa];
                    if (Ka > Z && Ja < C) {
                        if (Ja < Z) {
                            Ja = n(Z);
                            Za = false
                        } else Za = true; if (Ka > C) {
                            Ka = n(C);
                            cb = false
                        } else cb = true;
                        sa.push({
                            event: za,
                            start: Ja,
                            end: Ka,
                            isStart: Za,
                            isEnd: cb,
                            title: za.title,
                            sortKey: za.sortKey
                        })
                    }
                }
                P = sa.sort(qb);
                O = [];
                for (Z = 0; Z < P.length; Z++) {
                    C = P[Z];
                    for (sa = 0; sa < O.length; sa++)
                        if (!Kb(C, O[sa]).length) break;
                        (O[sa] || (O[sa] = [])).push(C)
                }
                P = O[0];
                for (Z = 0; Z < O.length; Z++) {
                    C =
                        O[Z];
                    for (sa = 0; sa < C.length; sa++) {
                        Fa = C[sa];
                        Fa.forwardSegs = [];
                        for (ta = Z + 1; ta < O.length; ta++) Kb(Fa, O[ta], Fa.forwardSegs)
                    }
                }
                if (P) {
                    for (Z = 0; Z < P.length; Z++) Lb(P[Z]);
                    for (Z = 0; Z < P.length; Z++) zb(P[Z], 0, 0)
                }
                P = [];
                for (Z = 0; Z < O.length; Z++) {
                    C = O[Z];
                    for (sa = 0; sa < C.length; sa++) P.push(C[sa])
                }
                Z = P;
                for (O = 0; O < Z.length; O++) {
                    P = Z[O];
                    P.col = E;
                    F.push(P)
                }
            }
            q(F);
            Q = F.length;
            E = "";
            w = X();
            O = L("isRTL");
            for (M = 0; M < Q; M++) {
                H = F[M];
                I = H.event;
                P = l(n(H.start), L("minHeightInSlots") * L("slotMinutes"));
                if (H.end < P) H.end = P;
                P = Ha(H.start, H.start);
                Z = Ha(H.start,
                    H.end);
                C = xa(H.col);
                sa = Ta(H.col);
                ta = sa - C;
                sa -= ta * 0.025;
                ta = sa - C;
                Fa = ta * (H.forwardCoord - H.backwardCoord);
                if (L("slotEventOverlap")) Fa = Math.max((Fa - 10) * 2, Fa);
                if (O) {
                    za = sa - H.backwardCoord * ta;
                    ta = za - Fa
                } else {
                    ta = C + H.backwardCoord * ta;
                    za = ta + Fa
                }
                ta = Math.max(ta, C);
                za = Math.min(za, sa);
                Fa = za - ta;
                H.top = P;
                H.left = ta;
                H.outerWidth = Fa;
                H.outerHeight = Z - P;
                E += t(I, H)
            }
            w[0].innerHTML = E;
            O = w.children();
            for (M = 0; M < Q; M++) {
                H = F[M];
                I = H.event;
                E = j(O[M]);
                P = R("eventRender", I, I, E);
                if (P === false) E.remove();
                else {
                    if (P && P !== true) {
                        E.remove();
                        E = j(P).css({
                            position: "absolute",
                            top: H.top,
                            left: H.left
                        }).appendTo(w)
                    }
                    H.element = E;
                    if (I._id === fa) u(I, E, H);
                    else E[0]._fci = M;
                    G(I, E)
                }
            }
            ma(w, F, u);
            for (M = 0; M < Q; M++) {
                H = F[M];
                if (E = H.element) {
                    H.vsides = Wa(E, true);
                    H.hsides = Ca(E) + Sa(E) + Ea(E);
                    I = E.find(".fc-event-title");
                    if (I.length) H.contentTop = I[0].offsetTop
                }
            }
            for (M = 0; M < Q; M++) {
                H = F[M];
                if (E = H.element) {
                    E[0].style.width = Math.max(0, H.outerWidth - H.hsides) + "px";
                    w = Math.max(0, H.outerHeight - H.vsides);
                    E[0].style.height = w + "px";
                    I = H.event;
                    if (H.contentTop !== f && w - H.contentTop < 10) {
                        E.find("div.fc-event-time").text(Da(I.start,
                            L("timeFormat")) + " - " + I.title);
                        E.find("div.fc-event-title").remove()
                    }
                    R("eventAfterRender", I, I, E)
                }
            }
        };
        A.clearEvents = function() {
            la().empty();
            X().empty()
        };
        A.slotSegHtml = t;
        Gb.call(A);
        var L = A.opt,
            R = A.trigger,
            T = A.isEventDraggable,
            ba = A.isEventResizable,
            D = A.eventEnd,
            ja = A.eventElementHandlers,
            pa = A.setHeight,
            la = A.getDaySegmentContainer,
            X = A.getSlotSegmentContainer,
            Ra = A.getHoverListener,
            ga = A.getMaxMinute,
            va = A.getMinMinute,
            Ha = A.timePosition,
            ra = A.getIsCellAllDay,
            xa = A.colContentLeft,
            Ta = A.colContentRight,
            v = A.cellToDate,
            ia = A.getColCnt,
            W = A.getColWidth,
            ka = A.getSnapHeight,
            Aa = A.getSnapMinutes,
            ea = A.getSlotContainer,
            G = A.reportEventElement,
            N = A.showEvents,
            na = A.hideEvents,
            oa = A.eventDrop,
            ua = A.eventResize,
            Ia = A.renderDayOverlay,
            Ba = A.clearOverlays,
            Qa = A.renderDayEvents,
            aa = A.calendar,
            Da = aa.formatDate,
            ya = aa.formatDates;
        A.draggableDayEvent = function(V, fa, F) {
            function Q() {
                if (!w) {
                    fa.width(M).height("").draggable("option", "grid", null);
                    w = true
                }
            }
            var H = F.isStart,
                M, I, w = true,
                C, E = Ra(),
                O = W(),
                P = ka(),
                Z = Aa(),
                sa = va(),
                Fa = L("dragBetweenAllDayAndSlots");
            fa.draggable({
                opacity: L("dragOpacity", "month"),
                revertDuration: L("dragRevertDuration"),
                start: function(ta, za) {
                    R("eventDragStart", fa, V, ta, za);
                    na(V, fa);
                    M = fa.width();
                    E.start(function(Ja, Ka) {
                        Ba();
                        if (Ja) {
                            I = false;
                            var Za = v(0, Ka.col),
                                cb = v(0, Ja.col);
                            C = p(cb, Za);
                            if (Ja.row)
                                if (Fa && H) {
                                    if (w) {
                                        fa.width(O - 10);
                                        qa(fa, P * Math.round((V.end ? (V.end - V.start) / Vb : L("defaultEventMinutes")) / Z));
                                        fa.draggable("option", "grid", [O, 1]);
                                        w = false
                                    }
                                } else I = true;
                            else {
                                Ia(g(n(V.start), C), g(La(V), C));
                                Q()
                            }
                            I = I || w && !C
                        } else {
                            Q();
                            I = true
                        }
                        fa.draggable("option",
                            "revert", I)
                    }, ta, "drag")
                },
                stop: function(ta, za) {
                    E.stop();
                    Ba();
                    R("eventDragStop", fa, V, ta, za);
                    if (I) {
                        Q();
                        fa.css("filter", "");
                        N(V, fa)
                    } else {
                        var Ja = 0;
                        if (Fa && !w) Ja = Math.round((fa.offset().top - ea().offset().top) / P) * Z + sa - (V.start.getHours() * 60 + V.start.getMinutes());
                        oa(this, V, C, Ja, w, ta, za)
                    }
                }
            })
        }
    }

    function Lb(q) {
        var s = q.forwardSegs,
            t = 0,
            u, y;
        if (q.forwardPressure === f) {
            for (u = 0; u < s.length; u++) {
                y = s[u];
                Lb(y);
                t = Math.max(t, 1 + y.forwardPressure)
            }
            q.forwardPressure = t
        }
    }

    function zb(q, s, t) {
        var u = q.forwardSegs;
        if (q.forwardCoord ===
            f) {
            if (u.length) {
                u.sort(Wb);
                zb(u[0], s + 1, t);
                q.forwardCoord = u[0].backwardCoord
            } else q.forwardCoord = 1;
            q.backwardCoord = q.forwardCoord - (q.forwardCoord - t) / (s + 1);
            for (s = 0; s < u.length; s++) zb(u[s], 0, q.forwardCoord)
        }
    }

    function Kb(q, s, t) {
        t = t || [];
        for (var u = 0; u < s.length; u++) q.end > s[u].start && q.start < s[u].end && t.push(s[u]);
        return t
    }

    function Wb(q, s) {
        return s.forwardPressure - q.forwardPressure || (q.backwardCoord || 0) - (s.backwardCoord || 0) || qb(q, s)
    }

    function qb(q, s) {
        return q.start - s.start || (q.sortKey || 0) - (s.sortKey || 0) || s.end -
            s.start - (q.end - q.start) || (q.title || "").localeCompare(s.title)
    }

    function tb(q, s, t) {
        function u(G, N) {
            var na = Ta[G];
            if (j.isPlainObject(na)) return Oa(na, N || t);
            return na
        }

        function y(G, N) {
            return s.trigger.apply(s, [G, N || X].concat(Array.prototype.slice.call(arguments, 2), [X]))
        }

        function J(G) {
            return G.end ? n(G.end) : Ra(G)
        }

        function A(G, N, na) {
            G = ra[G._id];
            var oa, ua = G.length;
            for (oa = 0; oa < ua; oa++)
                if (!N || G[oa][0] != N[0]) G[oa][na]()
        }

        function L(G, N, na, oa) {
            na = na || 0;
            for (var ua, Ia = G.length, Ba = 0; Ba < Ia; Ba++) {
                ua = G[Ba];
                if (oa !== f) ua.allDay =
                    oa;
                l(g(ua.start, N, true), na);
                if (ua.end) ua.end = l(g(ua.end, N, true), na);
                ga(ua, Ta)
            }
        }

        function R(G, N, na) {
            na = na || 0;
            for (var oa, ua = G.length, Ia = 0; Ia < ua; Ia++) {
                oa = G[Ia];
                oa.end = l(g(J(oa), N, true), na);
                ga(oa, Ta)
            }
        }

        function T(G, N) {
            var na = X.getColCnt(),
                oa = ea ? -1 : 1,
                ua = ea ? na - 1 : 0;
            if (typeof G == "object") {
                N = G.col;
                G = G.row
            }
            return G * na + (N * oa + ua)
        }

        function ba(G) {
            var N = X.visStart.getDay();
            G += ka[N];
            return Math.floor(G / W) * 7 + Aa[(G % W + W) % W] - N
        }

        function D(G) {
            var N = n(X.visStart);
            g(N, G);
            return N
        }

        function ja(G) {
            return p(G, X.visStart)
        }

        function pa(G) {
            var N =
                X.visStart.getDay();
            G += N;
            return Math.floor(G / 7) * W + ka[(G % 7 + 7) % 7] - ka[N]
        }

        function la(G) {
            var N = X.getColCnt();
            return {
                row: Math.floor(G / N),
                col: (G % N + N) % N * (ea ? -1 : 1) + (ea ? N - 1 : 0)
            }
        }
        var X = this;
        X.element = q;
        X.calendar = s;
        X.name = t;
        X.opt = u;
        X.trigger = y;
        X.isEventDraggable = function(G) {
            var N = G.source || {};
            return kb(G.startEditable, N.startEditable, u("eventStartEditable"), G.editable, N.editable, u("editable")) && !u("disableDragging")
        };
        X.isEventResizable = function(G) {
            var N = G.source || {};
            return kb(G.durationEditable, N.durationEditable,
                u("eventDurationEditable"), G.editable, N.editable, u("editable")) && !u("disableResizing")
        };
        X.setEventData = function(G) {
            Ha = {};
            var N, na = G.length,
                oa;
            for (N = 0; N < na; N++) {
                oa = G[N];
                if (Ha[oa._id]) Ha[oa._id].push(oa);
                else Ha[oa._id] = [oa]
            }
        };
        X.clearEventData = function() {
            Ha = {};
            ra = {};
            xa = []
        };
        X.eventEnd = J;
        X.reportEventElement = function(G, N) {
            xa.push({
                event: G,
                element: N
            });
            if (ra[G._id]) ra[G._id].push(N);
            else ra[G._id] = [N]
        };
        X.triggerEventDestroy = function() {
            j.each(xa, function(G, N) {
                X.trigger("eventDestroy", N.event, N.event, N.element)
            })
        };
        X.eventElementHandlers = function(G, N) {
            N.on(Ab() ? "touchend" : "click", function(na) {
                if (!N.hasClass("ui-draggable-dragging") && !N.hasClass("ui-resizable-resizing")) return y("eventClick", this, G, na)
            }).hover(function(na) {
                y("eventMouseover", this, G, na)
            }, function(na) {
                y("eventMouseout", this, G, na)
            })
        };
        X.showEvents = function(G, N) {
            A(G, N, "show")
        };
        X.hideEvents = function(G, N) {
            A(G, N, "hide")
        };
        X.eventDrop = function(G, N, na, oa, ua, Ia, Ba) {
            var Qa = N.allDay,
                aa = N._id;
            L(Ha[aa], na, oa, ua);
            y("eventDrop", G, N, na, oa, ua, function() {
                L(Ha[aa], -na, -oa, Qa);
                va(aa)
            }, Ia, Ba);
            va(aa)
        };
        X.eventResize = function(G, N, na, oa, ua, Ia) {
            var Ba = N._id,
                Qa = N._start,
                aa = N._end;
            R(Ha[Ba], na, oa);
            y("eventResize", G, N, na, oa, function() {
                N.start = Qa;
                N.end = aa;
                ga(N);
                va(Ba)
            }, ua, Ia);
            va(Ba)
        };
        var Ra = X.defaultEventEnd,
            ga = s.normalizeEvent,
            va = s.reportEventChange,
            Ha = {},
            ra = {},
            xa = [],
            Ta = s.options;
        X.isHiddenDay = function(G) {
            if (typeof G == "object") G = G.getDay();
            return ia[G]
        };
        X.skipHiddenDays = function(G, N, na) {
            for (N = N || 1; ia[(G.getDay() + (na ? N : 0) + 7) % 7];) g(G, N)
        };
        X.getCellsPerWeek = function() {
            return W
        };
        X.dateToCell = function(G) {
            G = ja(G);
            G = pa(G);
            return la(G)
        };
        X.dateToDayOffset = ja;
        X.dayOffsetToCellOffset = pa;
        X.cellOffsetToCell = la;
        X.cellToDate = function() {
            var G = T.apply(null, arguments);
            G = ba(G);
            return D(G)
        };
        X.cellToCellOffset = T;
        X.cellOffsetToDayOffset = ba;
        X.dayOffsetToDate = D;
        X.rangeToSegments = function(G, N) {
            for (var na = X.getRowCnt(), oa = X.getColCnt(), ua = [], Ia = ja(G), Ba = ja(N), Qa = pa(Ia), aa = pa(Ba) - 1, Da = 0; Da < na; Da++) {
                var ya = Da * oa,
                    V = Math.max(Qa, ya);
                ya = Math.min(aa, ya + oa - 1);
                if (V <= ya) {
                    var fa = la(V),
                        F = la(ya);
                    fa = [fa.col,
                        F.col
                    ].sort();
                    V = ba(V) == Ia;
                    ya = ba(ya) + 1 == Ba;
                    ua.push({
                        row: Da,
                        leftCol: fa[0],
                        rightCol: fa[1],
                        isStart: V,
                        isEnd: ya
                    })
                }
            }
            return ua
        };
        var v = u("hiddenDays") || [],
            ia = [],
            W, ka = [],
            Aa = [],
            ea = u("isRTL");
        (function() {
            u("weekends") === false && v.push(0, 6);
            for (var G = 0, N = 0; G < 7; G++) {
                ka[G] = N;
                ia[G] = j.inArray(G, v) != -1;
                if (!ia[G]) {
                    Aa[N] = G;
                    N++
                }
            }
            W = N;
            if (!W) throw "invalid hiddenDays";
        })()
    }

    function Gb() {
        function q(F, Q, H) {
            F = s([F], true, false);
            var M = [];
            ib(F, function(I, w) {
                I.row === Q && w.css("top", H);
                M.push(w[0])
            });
            return M
        }

        function s(F, Q, H) {
            var M =
                N(),
                I = Q ? j("<div/>") : M;
            F = t(F);
            var w;
            u(F);
            w = y(F);
            I[0].innerHTML = w;
            I = I.children();
            Q && M.append(I);
            J(F, I);
            ib(F, function(C, E) {
                C.hsides = Ca(E) + Sa(E) + Ea(E)
            });
            ib(F, function(C, E) {
                E.width(Math.max(0, C.outerWidth - C.hsides))
            });
            ib(F, function(C, E) {
                C.outerHeight = E.outerHeight(true)
            });
            A(F, H);
            return F
        }

        function t(F) {
            for (var Q = [], H = 0; H < F.length; H++) {
                var M = F[H],
                    I = M.start,
                    w = La(M);
                I = Qa(I, w);
                for (w = 0; w < I.length; w++) I[w].event = M;
                Q.push.apply(Q, I)
            }
            return Q
        }

        function u(F) {
            for (var Q = ja("isRTL"), H = 0; H < F.length; H++) {
                var M = F[H],
                    I =
                    (Q ? M.isStart : M.isEnd) ? G : Aa,
                    w = ((Q ? M.isEnd : M.isStart) ? ea : ka)(M.leftCol);
                I = I(M.rightCol);
                M.left = w;
                M.outerWidth = I - w
            }
        }

        function y(F) {
            for (var Q = "", H = 0; H < F.length; H++) {
                var M = F[H],
                    I = "",
                    w = ja("isRTL"),
                    C = M.event,
                    E = C.url,
                    O = ["fc-event", "fc-event-hori"];
                la(C) && O.push("fc-event-draggable");
                M.isStart && O.push("fc-event-start");
                M.isEnd && O.push("fc-event-end");
                O = O.concat(C.className);
                if (C.source) O = O.concat(C.source.className || []);
                var P = Cb(C, ja);
                I += E ? "<a href='" + Pa(E) + "'" : "<div";
                I += " class='" + O.join(" ") + "' style='position:absolute;left:" +
                    M.left + "px;" + P + "'><div class='fc-event-inner'>";
                if (C.allDay || M.isStart) I += "<span class='fc-event-time'>" + Pa(na(C.start, C.end, C.allDay && D.name != "month" ? ja("timeFormat", "allDay") : ja("timeFormat"))) + "</span>";
                I += "<span class='fc-event-title'>" + Pa(C.title || "") + "</span></div>";
                if (M.isEnd && X(C)) I += "<div class='ui-resizable-handle ui-resizable-" + (w ? "w" : "e") + "'>&nbsp;&nbsp;&nbsp;</div>";
                I += "</" + (E ? "a" : "div") + ">";
                Q += I
            }
            return Q
        }

        function J(F, Q) {
            for (var H = 0; H < F.length; H++) {
                var M = F[H],
                    I = M.event,
                    w = Q.eq(H);
                I = pa("eventRender",
                    I, I, w);
                if (I === false) w.remove();
                else {
                    if (I && I !== true) {
                        I = j(I).css({
                            position: "absolute",
                            left: M.left
                        });
                        w.replaceWith(I);
                        w = I
                    }
                    M.element = w
                }
            }
        }

        function A(F, Q) {
            var H = L(F),
                M = R(),
                I = [];
            if (Q)
                for (var w = 0; w < M.length; w++) M[w].height(H[w]);
            for (w = 0; w < M.length; w++) I.push(M[w].position().top);
            ib(F, function(C, E) {
                E.css("top", I[C.row] + C.top)
            })
        }

        function L(F) {
            var Q = v(),
                H = ia(),
                M = [],
                I = v(),
                w = [],
                C, E, O;
            for (C = 0; C < F.length; C++) {
                E = F[C];
                O = E.row;
                if (E.element)
                    if (w[O]) w[O].push(E);
                    else w[O] = [E]
            }
            for (O = 0; O < I; O++) {
                F = w;
                C = O;
                E = [];
                var P;
                P = w[O] || [];
                P.sort(Xb);
                for (var Z = [], sa = 0; sa < P.length; sa++) {
                    for (var Fa = P[sa], ta = 0; ta < Z.length; ta++) {
                        var za;
                        a: {
                            za = Z[ta];
                            for (var Ja = 0; Ja < za.length; Ja++) {
                                var Ka = za[Ja];
                                if (Ka.leftCol <= Fa.rightCol && Ka.rightCol >= Fa.leftCol) {
                                    za = true;
                                    break a
                                }
                            }
                            za = false
                        }
                        if (!za) break
                    }
                    if (Z[ta]) Z[ta].push(Fa);
                    else Z[ta] = [Fa]
                }
                P = Z;
                for (Z = 0; Z < P.length; Z++) E.push.apply(E, P[Z]);
                F[C] = E
            }
            for (I = 0; I < Q; I++) {
                O = w[I];
                F = [];
                for (P = 0; P < H; P++) F.push(0);
                for (C = 0; C < O.length; C++) {
                    P = E = O[C];
                    Z = F.slice(E.leftCol, E.rightCol + 1);
                    Z = Math.max.apply(Math, Z);
                    P.top = Z;
                    for (P =
                        E.leftCol; P <= E.rightCol; P++) F[P] = E.top + E.outerHeight
                }
                M.push(Math.max.apply(Math, F))
            }
            return M
        }

        function R() {
            var F, Q = v(),
                H = [];
            for (F = 0; F < Q; F++) H[F] = W(F).find("div.fc-day-content > div");
            return H
        }

        function T(F, Q) {
            var H = N();
            ib(F, function(M, I, w) {
                var C = M.event;
                if (C._id === Q) ba(C, I, M);
                else I[0]._fci = w
            });
            ma(H, F, ba)
        }

        function ba(F, Q, H) {
            la(F) && D.draggableDayEvent(F, Q, H);
            H.isEnd && X(F) && D.resizableDayEvent(F, Q, H);
            va(F, Q)
        }
        var D = this;
        D.renderDayEvents = function(F, Q) {
            var H = s(F, false, true);
            ib(H, function(M, I) {
                ga(M.event,
                    I)
            });
            T(H, Q);
            ib(H, function(M, I) {
                pa("eventAfterRender", M.event, M.event, I)
            })
        };
        D.draggableDayEvent = function(F, Q) {
            var H = Ba(),
                M;
            Q.draggable({
                delay: 50,
                opacity: ja("dragOpacity"),
                revertDuration: ja("dragRevertDuration"),
                start: function(I, w) {
                    pa("eventDragStart", Q, F, I, w);
                    ra(F, Q);
                    H.start(function(C, E, O, P) {
                        Q.draggable("option", "revert", !C || !O && !P);
                        ua();
                        if (C) {
                            E = aa(E);
                            C = aa(C);
                            M = p(C, E);
                            oa(g(n(F.start), M), g(La(F), M))
                        } else M = 0
                    }, I, "drag")
                },
                stop: function(I, w) {
                    H.stop();
                    ua();
                    pa("eventDragStop", Q, F, I, w);
                    if (M) xa(this, F, M,
                        0, F.allDay, I, w);
                    else {
                        Q.css("filter", "");
                        Ha(F, Q)
                    }
                }
            })
        };
        D.resizableDayEvent = function(F, Q, H) {
            var M = ja("isRTL") ? "w" : "e",
                I = Q.find(".ui-resizable-" + M),
                w = false;
            gb(Q);
            Q.mousedown(function(C) {
                C.preventDefault()
            }).click(function(C) {
                if (w) {
                    C.preventDefault();
                    C.stopImmediatePropagation()
                }
            });
            I.mousedown(function(C) {
                if (C.which == 1) {
                    w = true;
                    var E = Ba();
                    v();
                    ia();
                    var O = Q.css("top"),
                        P, Z, sa = j.extend({}, F),
                        Fa = fa(V(F.start));
                    Ia();
                    j("body").css("cursor", M + "-resize").one("mouseup", function(ta) {
                        pa("eventResizeStop", this, F, ta);
                        j("body").css("cursor", "");
                        E.stop();
                        ua();
                        P && Ta(this, F, P, 0, ta);
                        setTimeout(function() {
                            w = false
                        }, 0)
                    });
                    pa("eventResizeStart", this, F, C);
                    E.start(function(ta, za) {
                        if (ta) {
                            var Ja = Da(za),
                                Ka = Da(ta);
                            Ka = Math.max(Ka, Fa);
                            if (P = ya(Ka) - ya(Ja)) {
                                sa.end = g(Ra(F), P, true);
                                Ja = Z;
                                Z = q(sa, H.row, O);
                                Z = j(Z);
                                Z.find("*").css("cursor", M + "-resize");
                                Ja && Ja.remove();
                                ra(F)
                            } else if (Z) {
                                Ha(F);
                                Z.remove();
                                Z = null
                            }
                            ua();
                            oa(F.start, g(La(F), P))
                        }
                    }, C)
                }
            })
        };
        var ja = D.opt,
            pa = D.trigger,
            la = D.isEventDraggable,
            X = D.isEventResizable,
            Ra = D.eventEnd,
            ga = D.reportEventElement,
            va = D.eventElementHandlers,
            Ha = D.showEvents,
            ra = D.hideEvents,
            xa = D.eventDrop,
            Ta = D.eventResize,
            v = D.getRowCnt,
            ia = D.getColCnt,
            W = D.allDayRow,
            ka = D.colLeft,
            Aa = D.colRight,
            ea = D.colContentLeft,
            G = D.colContentRight,
            N = D.getDaySegmentContainer,
            na = D.calendar.formatDates,
            oa = D.renderDayOverlay,
            ua = D.clearOverlays,
            Ia = D.clearSelection,
            Ba = D.getHoverListener,
            Qa = D.rangeToSegments,
            aa = D.cellToDate,
            Da = D.cellToCellOffset,
            ya = D.cellOffsetToDayOffset,
            V = D.dateToDayOffset,
            fa = D.dayOffsetToCellOffset
    }

    function Ab() {
        return navigator.userAgent.match(/iPod|iPhone|iPad/i) !=
            null
    }

    function ib(q, s) {
        for (var t = 0; t < q.length; t++) {
            var u = q[t],
                y = u.element;
            y && s(u, y, t)
        }
    }

    function Xb(q, s) {
        return s.rightCol - s.leftCol - (q.rightCol - q.leftCol) || s.event.allDay - q.event.allDay || q.event.start - s.event.start || (q.event.sortKey || 0) - (s.event.sortKey || 0) || (q.event.title || "").localeCompare(s.event.title)
    }

    function ub() {
        function q(T) {
            if (R) {
                R = false;
                L();
                y("unselect", null, T)
            }
        }

        function s(T, ba, D, ja) {
            R = true;
            y("select", null, T, ba, D, ja)
        }
        var t = this;
        t.select = function(T, ba, D) {
            q();
            ba || (ba = J(T, D));
            A(T, ba, D);
            s(T,
                ba, D)
        };
        t.unselect = q;
        t.reportSelection = s;
        t.daySelectionMousedown = function(T) {
            var ba = t.cellToDate,
                D = t.getIsCellAllDay,
                ja = t.getHoverListener(),
                pa = t.reportDayClick;
            if (T.which == 1 && u("selectable")) {
                q(T);
                var la;
                ja.start(function(X, Ra) {
                    L();
                    if (X && D(X)) {
                        la = [ba(Ra), ba(X)].sort(jb);
                        A(la[0], la[1], true)
                    } else la = null
                }, T);
                j(document).one("mouseup", function(X) {
                    ja.stop();
                    if (la) {
                        +la[0] == +la[1] && pa(la[0], true, X);
                        s(la[0], la[1], true, X)
                    }
                })
            }
        };
        var u = t.opt,
            y = t.trigger,
            J = t.defaultSelectionEnd,
            A = t.renderSelection,
            L = t.clearSelection,
            R = false;
        u("selectable") && u("unselectAuto") && j(document).mousedown(function(T) {
            var ba = u("unselectCancel");
            if (ba)
                if (j(T.target).closest(ba).length) return;
            q(T)
        })
    }

    function Db() {
        this.renderOverlay = function(t, u) {
            var y = s.shift();
            y || (y = j("<div class='fc-cell-overlay' style='position:absolute;z-index:3'/>"));
            y[0].parentNode != u[0] && y.appendTo(u);
            q.push(y.css(t).show());
            return y
        };
        this.clearOverlays = function() {
            for (var t; t = q.shift();) s.push(t.hide().unbind())
        };
        var q = [],
            s = []
    }

    function Eb(q) {
        var s, t;
        this.build = function() {
            s = [];
            t = [];
            q(s, t)
        };
        this.cell = function(u, y) {
            var J = s.length,
                A = t.length,
                L, R = -1,
                T = -1;
            for (L = 0; L < J; L++)
                if (y >= s[L][0] && y < s[L][1]) {
                    R = L;
                    break
                }
            for (L = 0; L < A; L++)
                if (u >= t[L][0] && u < t[L][1]) {
                    T = L;
                    break
                }
            return R >= 0 && T >= 0 ? {
                row: R,
                col: T
            } : null
        };
        this.rect = function(u, y, J, A, L) {
            L = L.offset();
            return {
                top: s[u][0] - L.top,
                left: t[y][0] - L.left,
                width: t[A][1] - t[y][0],
                height: s[J][1] - s[u][0]
            }
        }
    }

    function Fb(q) {
        function s(A) {
            if (A.pageX === f) {
                A.pageX = A.originalEvent.pageX;
                A.pageY = A.originalEvent.pageY
            }
            A = q.cell(A.pageX, A.pageY);
            if (!A != !J || A && (A.row !=
                J.row || A.col != J.col)) {
                if (A) {
                    y || (y = A);
                    u(A, y, A.row - y.row, A.col - y.col)
                } else u(A, y);
                J = A
            }
        }
        var t, u, y, J;
        this.start = function(A, L, R) {
            u = A;
            y = J = null;
            q.build();
            s(L);
            t = R || "mousemove";
            j(document).bind(t, s)
        };
        this.stop = function() {
            j(document).unbind(t, s);
            return J
        }
    }

    function sb(q) {
        var s = this,
            t = {},
            u = {},
            y = {};
        s.left = function(J) {
            return u[J] = u[J] === f ? (t[J] = t[J] || q(J)).position().left : u[J]
        };
        s.right = function(J) {
            return y[J] = y[J] === f ? s.left(J) + (t[J] = t[J] || q(J)).width() : y[J]
        };
        s.clear = function() {
            t = {};
            u = {};
            y = {}
        }
    }
    var nb = {
            defaultView: "month",
            aspectRatio: 1.35,
            header: {
                left: "title",
                center: "",
                right: "today prev,next"
            },
            weekends: true,
            weekNumbers: false,
            weekNumberCalculation: "iso",
            weekNumberShortTitle: "W",
            weekNumberTitle: "Week",
            allDayDefault: true,
            ignoreTimezone: true,
            dragBetweenAllDayAndSlots: true,
            minHeightInSlots: 1,
            lazyFetching: true,
            startParam: "start",
            endParam: "end",
            titleFormat: {
                month: "MMMM yyyy",
                week: "MMM d[ yyyy]{ '&#8212;'[ MMM] d yyyy}",
                day: "dddd, MMM d, yyyy"
            },
            columnFormat: {
                month: "ddd",
                week: "ddd M/d",
                day: "dddd M/d"
            },
            timeFormat: {
                "": "h(:mm)t"
            },
            isRTL: false,
            firstDay: 0,
            monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
            monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            buttonText: {
                prev: "<span class='fc-text-arrow'>&lsaquo;</span>",
                next: "<span class='fc-text-arrow'>&rsaquo;</span>",
                prevYear: "<span class='fc-text-arrow'>&laquo;</span>",
                nextYear: "<span class='fc-text-arrow'>&raquo;</span>",
                today: "today",
                month: "month",
                week: "week",
                day: "day"
            },
            theme: false,
            buttonIcons: {
                prev: "circle-triangle-w",
                next: "circle-triangle-e"
            },
            unselectAuto: true,
            dropAccept: "*",
            handleWindowResize: true
        },
        Yb = {
            header: {
                left: "next,prev today",
                center: "",
                right: "title"
            },
            buttonText: {
                prev: "<span class='fc-text-arrow'>&rsaquo;</span>",
                next: "<span class='fc-text-arrow'>&lsaquo;</span>",
                prevYear: "<span class='fc-text-arrow'>&raquo;</span>",
                nextYear: "<span class='fc-text-arrow'>&laquo;</span>"
            },
            buttonIcons: {
                prev: "circle-triangle-e",
                next: "circle-triangle-w"
            }
        },
        $a = j.fullCalendar = {
            version: "1.6.4"
        },
        hb = $a.views = {};
    j.fn.fullCalendar = function(q) {
        if (typeof q == "string") {
            var s = Array.prototype.slice.call(arguments, 1),
                t;
            this.each(function() {
                var y = j.data(this, "fullCalendar");
                if (y && j.isFunction(y[q])) {
                    y = y[q].apply(y, s);
                    if (t === f) t = y;
                    q == "destroy" && j.removeData(this, "fullCalendar")
                }
            });
            if (t !== f) return t;
            return this
        }
        q = q || {};
        var u = q.eventSources || [];
        delete q.eventSources;
        if (q.events) {
            u.push(q.events);
            delete q.events
        }
        q =
            j.extend(true, {}, nb, q.isRTL || q.isRTL === f && nb.isRTL ? Yb : {}, q);
        this.each(function(y, J) {
            var A = j(J),
                L = new b(A, q, u);
            A.data("fullCalendar", L);
            L.render()
        });
        return this
    };
    $a.sourceNormalizers = [];
    $a.sourceFetchers = [];
    var Mb = {
            dataType: "json",
            cache: false
        },
        Nb = 1;
    $a.addDays = g;
    $a.cloneDate = n;
    $a.parseDate = B;
    $a.parseISO8601 = z;
    $a.parseTime = S;
    $a.formatDate = ha;
    $a.formatDates = wa;
    $a.clearTime = o;
    var rb = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
        Pb = 864E5,
        Ob = 36E5,
        Vb = 6E4,
        Bb = {
            s: function(q) {
                return q.getSeconds()
            },
            ss: function(q) {
                return Xa(q.getSeconds())
            },
            m: function(q) {
                return q.getMinutes()
            },
            mm: function(q) {
                return Xa(q.getMinutes())
            },
            h: function(q) {
                return q.getHours() % 12 || 12
            },
            hh: function(q) {
                return Xa(q.getHours() % 12 || 12)
            },
            H: function(q) {
                return q.getHours()
            },
            HH: function(q) {
                return Xa(q.getHours())
            },
            d: function(q) {
                return q.getDate()
            },
            dd: function(q) {
                return Xa(q.getDate())
            },
            ddd: function(q, s) {
                return s.dayNamesShort[q.getDay()]
            },
            dddd: function(q, s) {
                return s.dayNames[q.getDay()]
            },
            M: function(q) {
                return q.getMonth() + 1
            },
            MM: function(q) {
                return Xa(q.getMonth() + 1)
            },
            MMM: function(q,
                s) {
                return s.monthNamesShort[q.getMonth()]
            },
            MMMM: function(q, s) {
                return s.monthNames[q.getMonth()]
            },
            yy: function(q) {
                return (q.getFullYear() + "").substring(2)
            },
            yyyy: function(q) {
                return q.getFullYear()
            },
            t: function(q) {
                return q.getHours() < 12 ? "a" : "p"
            },
            tt: function(q) {
                return q.getHours() < 12 ? "am" : "pm"
            },
            T: function(q) {
                return q.getHours() < 12 ? "A" : "P"
            },
            TT: function(q) {
                return q.getHours() < 12 ? "AM" : "PM"
            },
            u: function(q) {
                return ha(q, "yyyy-MM-dd'T'HH:mm:ss'Z'")
            },
            S: function(q) {
                q = q.getDate();
                if (q > 10 && q < 20) return "th";
                return ["st",
                    "nd", "rd"
                ][q % 10 - 1] || "th"
            },
            w: function(q, s) {
                return s.weekNumberCalculation(q)
            },
            W: function(q) {
                var s = new Date(q.getTime());
                s.setDate(s.getDate() + 4 - (s.getDay() || 7));
                q = s.getTime();
                s.setMonth(0);
                s.setDate(1);
                return Math.floor(Math.round((q - s) / 864E5) / 7) + 1
            }
        };
    $a.dateFormatters = Bb;
    $a.applyAll = ob;
    hb.month = function(q, s) {
        var t = this;
        t.render = function(R, T) {
            if (T) {
                e(R, T);
                R.setDate(1)
            }
            var ba = u("firstDay"),
                D = n(R, true);
            D.setDate(1);
            var ja = e(n(D), 1),
                pa = n(D);
            g(pa, -((pa.getDay() - ba + 7) % 7));
            J(pa);
            var la = n(ja);
            g(la, (7 - la.getDay() +
                ba) % 7);
            J(la, -1, true);
            ba = A();
            var X = Math.round(p(la, pa) / 7);
            if (u("weekMode") == "fixed") {
                g(la, (6 - X) * 7);
                X = 6
            }
            t.title = L(D, u("titleFormat"));
            t.start = D;
            t.end = ja;
            t.visStart = pa;
            t.visEnd = la;
            y(X, ba, true)
        };
        vb.call(t, q, s, "month");
        var u = t.opt,
            y = t.renderBasic,
            J = t.skipHiddenDays,
            A = t.getCellsPerWeek,
            L = s.formatDate
    };
    hb.basicWeek = function(q, s) {
        var t = this;
        t.render = function(R, T) {
            T && g(R, T * 7);
            var ba = g(n(R), -((R.getDay() - u("firstDay") + 7) % 7)),
                D = g(n(ba), 7),
                ja = n(ba);
            J(ja);
            var pa = n(D);
            J(pa, -1, true);
            var la = A();
            t.start = ba;
            t.end =
                D;
            t.visStart = ja;
            t.visEnd = pa;
            t.title = L(ja, g(n(pa), -1), u("titleFormat"));
            y(1, la, false)
        };
        vb.call(t, q, s, "basicWeek");
        var u = t.opt,
            y = t.renderBasic,
            J = t.skipHiddenDays,
            A = t.getCellsPerWeek,
            L = s.formatDates
    };
    hb.listWeek = function(q, s) {
        var t = this;
        t.render = function(R, T) {
            T && g(R, T * 7);
            var ba = g(n(R), -((R.getDay() - u("firstDay") + 7) % 7)),
                D = g(n(ba), 7),
                ja = n(ba);
            J(ja);
            var pa = n(D);
            J(pa, -1, true);
            var la = A();
            t.start = ba;
            t.end = D;
            t.visStart = ja;
            t.visEnd = pa;
            t.title = L(ja, g(n(pa), -1), u("titleFormat"));
            y(1, la, false)
        };
        Qb.call(t, q, s, "listWeek");
        var u = t.opt,
            y = t.renderList,
            J = t.skipHiddenDays,
            A = t.getCellsPerWeek,
            L = s.formatDates
    };
    hb.basicDay = function(q, s) {
        var t = this;
        t.render = function(L, R) {
            R && g(L, R);
            J(L, R < 0 ? -1 : 1);
            var T = n(L, true),
                ba = g(n(T), 1);
            t.title = A(L, u("titleFormat"));
            t.start = t.visStart = T;
            t.end = t.visEnd = ba;
            y(1, 1, false)
        };
        vb.call(t, q, s, "basicDay");
        var u = t.opt,
            y = t.renderBasic,
            J = t.skipHiddenDays,
            A = s.formatDate
    };
    h({
        weekMode: "fixed"
    });
    hb.agendaWeek = function(q, s) {
        var t = this;
        t.render = function(R, T) {
            T && g(R, T * 7);
            var ba = g(n(R), -((R.getDay() - u("firstDay") +
                    7) % 7)),
                D = g(n(ba), 7),
                ja = n(ba);
            J(ja);
            var pa = n(D);
            J(pa, -1, true);
            var la = A();
            t.title = L(ja, g(n(pa), -1), u("titleFormat"));
            t.start = ba;
            t.end = D;
            t.visStart = ja;
            t.visEnd = pa;
            y(la)
        };
        Hb.call(t, q, s, "agendaWeek");
        var u = t.opt,
            y = t.renderAgenda,
            J = t.skipHiddenDays,
            A = t.getCellsPerWeek,
            L = s.formatDates
    };
    hb.agendaDay = function(q, s) {
        var t = this;
        t.render = function(L, R) {
            R && g(L, R);
            J(L, R < 0 ? -1 : 1);
            var T = n(L, true),
                ba = g(n(T), 1);
            t.title = A(L, u("titleFormat"));
            t.start = t.visStart = T;
            t.end = t.visEnd = ba;
            y(1)
        };
        Hb.call(t, q, s, "agendaDay");
        var u =
            t.opt,
            y = t.renderAgenda,
            J = t.skipHiddenDays,
            A = s.formatDate
    };
    h({
        allDaySlot: true,
        allDayText: "all-day",
        firstHour: 6,
        slotMinutes: 30,
        defaultEventMinutes: 120,
        axisFormat: "h(:mm)tt",
        timeFormat: {
            agenda: "h:mm{ - h:mm}"
        },
        dragOpacity: {
            agenda: 0.5
        },
        minTime: 0,
        maxTime: 24,
        minDefaultDayStartHour: 0,
        maxDefaultDayStartHour: 24,
        slotEventOverlap: true
    })
})(jQuery);
var CCL;
(function(j) {
    var f = {},
        h = function() {
            function b(c, d) {
                if (typeof d === "undefined") d = "";
                this._elem = $("#" + c);
                this._eventsPrefix = d;
                f[c] = this
            }
            b.GetInstanceForElement = function(c) {
                return f[c]
            };
            b.prototype.Trigger = function(c) {
                for (var d = [], a = 0; a < arguments.length - 1; a++) d[a] = arguments[a + 1];
                this._elem.trigger(this._eventsPrefix + c, d)
            };
            return b
        }();
    j.DomElementClass = h
})(CCL || (CCL = {}));
var __extends = this.__extends || function(j, f) {
    function h() {
        this.constructor = j
    }
    for (var b in f)
        if (f.hasOwnProperty(b)) j[b] = f[b];
    h.prototype = f.prototype;
    j.prototype = new h
};
(function(j) {
    j.PickerEvent = {
        Initialized: "PickerInitialized",
        Added: "PickerFilesAdded",
        Started: "PickerUploadStarted",
        Stopped: "PickerUploadStopped",
        ResultsChanged: "PickerResultsChanged"
    };
    var f = function(h) {
        function b(c, d) {
            h.call(this, c);
            this._settings = d
        }
        __extends(b, h);
        b.prototype.EncodeFileName = function(c) {
            return encodeURIComponent(c.replace("#", "%23"))
        };
        b.prototype.GenerateGuidPart = function(c) {
            var d = (Math.random().toString(16) + "000000000").substr(2, 8);
            return c ? "-" + d.substr(0, 4) + "-" + d.substr(4, 4) : d
        };
        b.prototype.GenerateGuid = function() {
            return this.GenerateGuidPart(false) + this.GenerateGuidPart(true) + this.GenerateGuidPart(true) + this.GenerateGuidPart(false)
        };
        b.prototype.GetFileRepoUrl = function(c, d) {
            return this.ReplaceUrlTokens(this._settings.FileRepoPath, c, d)
        };
        b.prototype.GetFileRepoProxy = function(c, d) {
            return this.ReplaceUrlTokens(this._settings.FileRepoProxy, c, d)
        };
        b.prototype.GetFileRepoOrProxyUrl = function(c, d) {
            var a = $.support.cors ? this.GetFileRepoUrl(c, d) : this.GetFileRepoProxy(c, d);
            a += a.indexOf("?") >
                -1 ? "&" : "?";
            a += "ts=" + (new Date).getTime();
            return a
        };
        b.prototype.ReplaceUrlTokens = function(c, d, a) {
            if (c.indexOf("{file}") != -1) c = c.replace("{file}", this.EncodeFileName(d));
            if (c.indexOf("{guid}") != -1) c = c.replace("{guid}", a || this.GenerateGuid());
            return c
        };
        b.prototype.ClearResults = function() {};
        b.prototype.AllowHide = function() {};
        return b
    }(j.DomElementClass);
    j.ItemPickerBase = f
})(CCL || (CCL = {}));
(function(j) {
    var f = function(h) {
        function b(c, d) {
            h.call(this, c, d);
            this._stateHidden = $("#" + this._settings.StateHiddenFieldClientId);
            this._resultsTable = $("#" + this._settings.FileListTableClientId);
            this._fileListItemTemplate = $("#" + this._settings.FileListItemTemplateId).html();
            this._checkFileDownloadCompleteTasks = {};
            this.Init();
            this.Trigger(j.PickerEvent.Initialized);
            this.GetDropboxFiles().length > 0 && this.Trigger(j.PickerEvent.ResultsChanged, {
                results: this.GetDropboxFiles()
            })
        }
        __extends(b, h);
        b.prototype.Init =
            function() {
                var c = this;
                if (!this._settings.ReadOnly) {
                    this._chooseButton = $(Dropbox.createChooseButton({
                        success: function(d) {
                            if (!(c._elem.hasClass("disabled") || c._resultsTable.find("tr").length > 0)) {
                                d = c.ConvertDropboxUploadResult(d);
                                c.UpdateDropboxList(d);
                                d.length > 0 && c.AddFiles(d)
                            }
                        },
                        linkType: "direct",
                        multiselect: this._settings.MultiselectAllowed
                    }));
                    this._elem.append(this._chooseButton)
                }
                this.UpdateDropboxList(this.GetDropboxFiles())
            };
        b.prototype.ConvertDropboxUploadResult = function(c) {
            if (!c) return [];
            return $.map(c,
                function(d) {
                    return {
                        name: d.name,
                        size: d.bytes,
                        thumbnailUrl: d.thumbnailLink,
                        dropBoxUrl: d.link,
                        icon: d.icon
                    }
                })
        };
        b.prototype.CheckAndSaveDropboxFiles = function(c) {
            for (var d = c.length - 1; d >= 0; d--)
                if (c[d].size > this._settings.MaxFileSize) {
                    c.splice(d, 1);
                    alert(this._settings.FileSizeExceededText)
                }
            this.SetDropboxFiles(c);
            return c
        };
        b.prototype.SetDropboxFiles = function(c) {
            this._stateHidden.val(JSON.stringify(c))
        };
        b.prototype.GetDropboxFiles = function() {
            return JSON.parse(this._stateHidden.val() || "[]")
        };
        b.prototype.UpdateDropboxList =
            function(c) {
                var d = this;
                c = this.CheckAndSaveDropboxFiles(c);
                this._resultsTable.find("tbody").find("tr").each(function() {
                    var l = $(this);
                    l.find(".error").length === 0 && l.remove()
                });
                if (c.length) {
                    this._settings.ReadOnly || this._chooseButton.hide();
                    for (var a = 0; a < c.length; a++) {
                        var e = c[a],
                            g = this._fileListItemTemplate.replace("{file.name}", e.name).replace("{file.bytes}", j.Utils.FormatFileSize(e.size, this._settings.KbText, this._settings.MbText));
                        g = $(g);
                        var k = g.find("td.preview img");
                        g.find("td.delete button").click(function(l) {
                            l =
                                $(l.target).closest("tr");
                            var o = l.find("td.name > span").text();
                            d.RemoveFile(o, l);
                            return false
                        });
                        e.thumbnailUrl ? k.attr("src", e.thumbnailUrl) : k.attr("src", e.icon).attr("height", "24").attr("width", "24");
                        this._resultsTable.append(g)
                    }
                } else this._settings.ReadOnly || this._chooseButton.show()
            };
        b.prototype.AddFiles = function(c) {
            var d = this;
            this.Trigger(j.PickerEvent.Started);
            this.Trigger(j.PickerEvent.Added, {
                files: c
            });
            this._selectedFiles = c;
            this._uploadedFiles = [];
            c.forEach(function(a) {
                if (a.error) d.SetFileErrorText(a,
                    a.error);
                else {
                    d.SetFileStatusText(a, d._settings.FileIsBeingDownloadedText + " 0%");
                    var e = "put",
                        g = d.GenerateGuid(),
                        k = d.GetFileRepoOrProxyUrl(a.name, g),
                        l = k,
                        o = "";
                    if (!$.support.cors) {
                        e = "post";
                        l += "&_method=put&" + d._settings.FileRepoHeaderDownloadFrom + "=true";
                        o = d._settings.FileRepoHeaderDownloadFrom + "=" + a.dropBoxUrl
                    }
                    var n = {};
                    n[d._settings.FileRepoHeaderDownloadFrom] = a.dropBoxUrl;
                    $.ajax({
                        url: l,
                        type: e,
                        dataType: "json",
                        data: o,
                        xhrFields: {
                            withCredentials: true
                        },
                        headers: n,
                        success: function() {
                            var m = Math.max(Math.round(a.size /
                                1E4), 500);
                            d._checkFileDownloadCompleteTasks[a.name] = setTimeout(function() {
                                d.CheckFileDownloadComplete(k, g, a, m)
                            }, m)
                        },
                        error: function() {
                            d.HandleError(a)
                        }
                    })
                }
            })
        };
        b.prototype.RemoveFile = function(c, d) {
            for (var a = this.GetDropboxFiles(), e = a.length; e--;)
                if (a[e].name === c) {
                    a.splice(e, 1);
                    break
                }
            this.CheckAndSaveDropboxFiles(a);
            d.remove();
            if (!a.length || this._settings.MultiselectAllowed) this._settings.ReadOnly || this._chooseButton.show();
            if (this._checkFileDownloadCompleteTasks[c]) {
                clearTimeout(this._checkFileDownloadCompleteTasks[c]);
                this._checkFileDownloadCompleteTasks[c] = null
            }
            a.length == 0 && this.Trigger(j.PickerEvent.Stopped, {
                results: []
            });
            this.Trigger(j.PickerEvent.ResultsChanged, {
                results: a
            })
        };
        b.prototype.CheckFileDownloadComplete = function(c, d, a, e) {
            var g = this;
            $.ajax({
                url: c + "&" + this._settings.FileRepoInfoParam + "=true",
                type: "get",
                dataType: "json",
                xhrFields: {
                    withCredentials: true
                },
                success: function(k) {
                    if (k.status === "DownloadCompleted" || k.status === "Available") {
                        g._checkFileDownloadCompleteTasks[a.name] = null;
                        a.id = k.fileId;
                        a.name = k.fileName;
                        a.type = k.mimeType;
                        a.size = k.fileSize;
                        a.fileUrl = g.GetFileRepoUrl(a.name, d);
                        a.deleteUrl = g.GetFileRepoUrl(a.name, d);
                        g._uploadedFiles.push(a);
                        g.SetFileStatusText(a, "");
                        if (g.AllUploadsFinished()) {
                            k = g.CheckAndSaveDropboxFiles(g._uploadedFiles);
                            g.UpdateDropboxList(k);
                            g.Trigger(j.PickerEvent.ResultsChanged, {
                                results: k
                            });
                            g.Trigger(j.PickerEvent.Stopped, {
                                results: k
                            })
                        }
                    } else {
                        k.status === "Downloading" && g.SetFileStatusText(a, g._settings.FileIsBeingDownloadedText + " " + k.statusProgress + "%");
                        g._checkFileDownloadCompleteTasks[a.name] =
                            setTimeout(function() {
                                g.CheckFileDownloadComplete(c, d, a, e)
                            }, e)
                    }
                },
                error: function() {
                    g.HandleError(a)
                }
            })
        };
        b.prototype.SetFileErrorText = function(c, d) {
            this.SetFileStatusText(c, d);
            this._resultsTable.find('td.name > span:contains("' + c.name + '")').closest("tr").find("td.status").addClass("error")
        };
        b.prototype.SetFileStatusText = function(c, d) {
            this._resultsTable.find('td.name > span:contains("' + c.name + '")').closest("tr").find("td.status > span").text(d)
        };
        b.prototype.HandleError = function(c) {
            this.SetFileErrorText(c,
                this._settings.UploadErrorText);
            if (this._checkFileDownloadCompleteTasks[c.name]) {
                clearTimeout(this._checkFileDownloadCompleteTasks[c.name]);
                this._checkFileDownloadCompleteTasks[c.name] = null
            }
            this.AllUploadsFinished() && this._uploadedFiles.length > 0 && this.Trigger(j.PickerEvent.Stopped, {
                results: this._uploadedFiles
            })
        };
        b.prototype.AllUploadsFinished = function() {
            var c = this,
                d = true;
            this._selectedFiles.forEach(function(a) {
                if (c._checkFileDownloadCompleteTasks[a.name] && c._checkFileDownloadCompleteTasks[a.name] !=
                    null) d = false
            });
            return d
        };
        b.prototype.ClearResults = function() {
            var c = true;
            this._resultsTable.find("tbody").find("tr").each(function() {
                var d = $(this);
                if (d.hasClass("clearme") || d.find(".error").length === 0) d.remove();
                else {
                    c = false;
                    d.addClass("clearme")
                }
            });
            c && this._chooseButton.show();
            this.Trigger(j.PickerEvent.ResultsChanged, {
                results: []
            })
        };
        b.prototype.AllowHide = function() {
            return this._resultsTable.find("tbody").find("tr .error").length === 0
        };
        return b
    }(j.ItemPickerBase);
    j.DropboxPicker = f
})(CCL || (CCL = {}));
(function(j) {
    var f = function(h) {
        function b(c, d) {
            var a = this;
            h.call(this, c, d);
            b.confirmReplaceMessage = d.ConfirmReplaceMessageText;
            this.fileUploaderContainer = $(".ccl-fileuploader-container");
            this._elem.on("fileuploadstarted", function() {
                a.Trigger(j.PickerEvent.Started)
            }).on("fileuploadadd", function() {
                for (var e = [], g = 0; g < arguments.length - 1; g++) e[g] = arguments[g + 1];
                a.Trigger(j.PickerEvent.Added, e[0])
            }).on("fileuploadstopped", function() {
                for (var e = [], g = 0; g < arguments.length - 1; g++) e[g] = arguments[g + 1];
                e[0].results =
                    a.fileUploaderContainer.fileupload("getUploadedFiles");
                a.Trigger(j.PickerEvent.Stopped, e[0])
            }).on("fileuploadresultschanged", function() {
                for (var e = [], g = 0; g < arguments.length - 1; g++) e[g] = arguments[g + 1];
                a.Trigger(j.PickerEvent.ResultsChanged, e[0])
            }).on("fileuploadsubmit", function() {
                for (var e = [], g = 0; g < arguments.length - 1; g++) e[g] = arguments[g + 1];
                e = e[0];
                e.guid = a.GenerateGuid();
                e.url = a.GetFileRepoOrProxyUrl(e.files[0].name, e.guid);
                e.type = "PUT";
                e.xhrFields = {
                    withCredentials: true
                }
            }).on("fileuploaddestroy", function() {
                for (var e = [], g = 0; g < arguments.length - 1; g++) e[g] = arguments[g + 1];
                e = e[0];
                e.type = "DELETE";
                e.xhrFields = {
                    withCredentials: true
                }
            }).on("fileuploaddone", function() {
                for (var e = [], g = 0; g < arguments.length - 1; g++) e[g] = arguments[g + 1];
                e = e[0];
                g = e.result;
                g = {
                    deleteUrl: a.GetFileRepoUrl(e.files[0].name, e.guid),
                    fileUrl: a.GetFileRepoUrl(e.files[0].name, e.guid),
                    id: g.fileId,
                    name: g.fileName,
                    size: g.fileSize,
                    type: g.mimeType,
                    thumbnailUrl: d.DefaultThumbnailUrl
                };
                e.result.files = [g]
            });
            this.Trigger(j.PickerEvent.Initialized)
        }
        __extends(b, h);
        b.ConfirmReplaceFile =
            function() {
                return confirm(b.confirmReplaceMessage)
            };
        b.prototype.ClearResults = function() {
            this.fileUploaderContainer.fileupload("clearResults")
        };
        b.prototype.AllowHide = function() {
            return this.fileUploaderContainer.fileupload("allowHide")
        };
        return b
    }(j.ItemPickerBase);
    j.FilePicker = f
})(CCL || (CCL = {}));
var tmpl;
(function(j) {
    j.FileRepoUploaderEvent = {
        PickerChanged: "FileRepoUploaderPickerChanged",
        ResultsChanged: "FileRepoUploaderResultsChanged"
    };
    var f = function(h) {
        function b(c, d) {
            var a = this;
            h.call(this, c);
            this._pickers = [];
            this._inlineModeFileList = [];
            this._inlineModeFileKeys = {};
            this._removedFiles = [];
            this._changedFiles = {};
            this._settings = d;
            $("#" + this._settings.ControlTabsClientId).on(j.ControlTabsEvent.TabIndexChanged, function() {
                for (var g = [], k = 0; k < arguments.length - 1; k++) g[k] = arguments[k + 1];
                (g = a._pickers[g[0].selectedTab]) &&
                a.Trigger(j.FileRepoUploaderEvent.PickerChanged, {
                    selectedPicker: g
                })
            });
            this._elem.on(j.PickerEvent.Initialized, function(g) {
                a._pickers.push(j.DomElementClass.GetInstanceForElement(g.target.id));
                a._pickers.length == 1 && a._settings.IsEmpty && a.Trigger(j.FileRepoUploaderEvent.PickerChanged, {
                    selectedPicker: a._pickers[0]
                })
            });
            this._elem.on(j.PickerEvent.ResultsChanged, function(g) {
                for (var k = [], l = 0; l < arguments.length - 1; l++) k[l] = arguments[l + 1];
                l = j.DomElementClass.GetInstanceForElement(g.target.id);
                k = k[0].results;
                var o = a._settings.ReadOnly ? a.GetControlTabs().GetCurrentTab() : a._pickers.indexOf(l);
                a.GetControlTabs().SetCurrentTab(o);
                a.HandleResultsChanges(k, o);
                a.Trigger(j.FileRepoUploaderEvent.ResultsChanged, {
                    results: k,
                    picker: l
                })
            });
            this._elem.on(j.PickerEvent.Started, function(g) {
                for (var k = 0; k < arguments.length - 1; k++);
                k = j.DomElementClass.GetInstanceForElement(g.target.id);
                k = a._settings.ReadOnly ? a.GetControlTabs().GetCurrentTab() : a._pickers.indexOf(k);
                a.HandleResultsChanges([{}], k)
            });
            if (d.InlineMode) {
                this._elem.on(j.PickerEvent.Added,
                    function() {
                        for (var g = [], k = 0; k < arguments.length - 1; k++) g[k] = arguments[k + 1];
                        d.UniqueFileNamesOnly && g[0].files.forEach(function(l) {
                            a._filesContainer.find("td.name").toArray().forEach(function(o) {
                                if (o.innerText === l.name)
                                    if (confirm(d.FileAlreadyExistsDialogText.replace("{0}", l.name))) {
                                        o = $(o).closest("." + d.FileListRowCssClass);
                                        var n = o.find("a." + d.RemoveActionCssClass);
                                        n = $(n).data("filekey");
                                        n = a.GetFileByKey(n);
                                        a.RemoveFile(n, o)
                                    } else l.error = d.FileAlreadyExistsErrorMessage
                            })
                        })
                    });
                this._elem.on(j.PickerEvent.Stopped,
                    function(g) {
                        for (var k = [], l = 0; l < arguments.length - 1; l++) k[l] = arguments[l + 1];
                        a.UpdateFileList(k[0].results, true);
                        a.UpdateFileListState(a._inlineModeFileList);
                        k = k[0].results && k[0].results.length > 0 && a._expandableContainer.getIsExpandedState();
                        l = j.DomElementClass.GetInstanceForElement(g.target.id);
                        l.ClearResults();
                        k && l.AllowHide() && a._expandableContainer.toggle()
                    });
                this._elem.on("hybrideditoritemtextupdated", function(g) {
                    for (var k = [], l = 0; l < arguments.length - 1; l++) k[l] = arguments[l + 1];
                    l = $(g.target).closest("." +
                        d.FileListRowCssClass).find("a." + d.RemoveActionCssClass);
                    l = $(l).data("filekey");
                    l = a.GetFileByKey(l);
                    l.rawFilename = k[0].value;
                    l.name = l.rawFilename;
                    if (l.extension) l.name += l.extension;
                    a._changedFiles[l.fileUrl] = l;
                    a._changedFilesStateHidden.val(JSON.stringify(a._changedFiles));
                    a.UpdateFileListState(a._inlineModeFileList);
                    k = a._pickers[a.GetControlTabs().GetCurrentTab()];
                    a.Trigger(j.FileRepoUploaderEvent.ResultsChanged, {
                        results: a._inlineModeFileList,
                        picker: k
                    })
                });
                this._expandableContainer = new ExpandableContainer(this._elem, {
                    expander: $("#" + this._settings.ExpandableHeaderClientId),
                    target: $("#" + this._settings.ExpandableContentClientId)
                });
                this._filesContainer = $("#" + d.FileListContainerId);
                this._filesContainer.on("click", "." + this._settings.RemoveActionCssClass, function(g) {
                    var k = $(g.target).data("filekey");
                    k = a.GetFileByKey(k);
                    g = $(g.target).closest("." + a._settings.FileListRowCssClass);
                    a.RemoveFile(k, g)
                });
                this._filesContainer.on("click", "." + this._settings.ViewActionCssClass, function(g) {
                    g = $(g.target).data("filekey");
                    g = a.GetFileByKey(g);
                    a.OpenFile(g, true)
                });
                this._filesContainer.on("click", "." + this._settings.EditActionCssClass, function(g) {
                    g = $(g.target).data("filekey");
                    g = a.GetFileByKey(g);
                    a.OpenFile(g, false)
                });
                this._filesContainer.on("click", "." + this._settings.DownloadActionCssClass, function(g) {
                    g = $(g.target).data("filekey");
                    g = a.GetFileByKey(g);
                    a.DownloadFile(g)
                });
                $("#" + this._settings.ViewDialogId).on("click", ".ccl-button-ok", function() {
                    if (a._openedForEditing) {
                        var g = $(".ccl-cssmodal-modal-iframe").attr("src");
                        $(".ccl-cssmodal-modal-iframe").attr("src",
                            g)
                    }
                });
                this._templatesContainer = document.createElement(this._filesContainer.prop("nodeName"));
                if (tmpl) this._fileListItemTemplate = tmpl(d.FileListItemTemplateId);
                this._fileListStateHidden = $("#" + this._settings.FileListHiddenStateClientId);
                var e = this.ReadFileList();
                e.length > 0 && this.UpdateFileList(e, false);
                this._changedFilesStateHidden = $("#" + this._settings.ChangedFilesHiddenStateClientId);
                this._removedFilesStateHidden = $("#" + this._settings.RemovedFilesHiddenStateClientId)
            }
        }
        __extends(b, h);
        b.prototype.RemoveFile =
            function(c, d) {
                var a = this;
                if (c.deleteUrl) $.ajax({
                    url: c.deleteUrl,
                    type: "DELETE",
                    xhrFields: {
                        withCredentials: true
                    },
                    success: function() {
                        a.RemoveFileFromList(c, d)
                    }
                });
                else {
                    this._removedFiles.push(c.fileUrl);
                    this._removedFilesStateHidden.val(JSON.stringify(this._removedFiles));
                    this.RemoveFileFromList(c, d)
                }
            };
        b.prototype.RemoveFileFromList = function(c, d) {
            d.remove();
            if (this._changedFiles[c.fileUrl]) {
                delete this._changedFiles[c.fileUrl];
                this._changedFilesStateHidden.val(JSON.stringify(this._changedFiles))
            }
            this._inlineModeFileList.splice(this._inlineModeFileList.indexOf(c),
                1);
            this.UpdateFileListState(this._inlineModeFileList);
            var a = this._pickers[this.GetControlTabs().GetCurrentTab()];
            this.Trigger(j.FileRepoUploaderEvent.ResultsChanged, {
                results: this._inlineModeFileList,
                picker: a
            })
        };
        b.prototype.OpenFile = function(c, d) {
            var a = this._settings.ViewEditUrl;
            a = a.replace("{filePath}", encodeURI(c.fileUrl));
            a = a.replace("{fileName}", encodeURIComponent(c.name));
            a = a.replace("{viewOnly}", d.toString());
            var e;
            e = c.modified ? new Date(c.modified) : new Date;
            this._openedForEditing = !d;
            a = a.replace("{uniqueId}",
                this.convertToTicks(e).toString());
            e = this._settings.EditableMimeTypes.indexOf(c.type) >= 0;
            var g = this.GetDialog();
            g.setTitle(c.name);
            g.setIframeUrl(a);
            g.openDialog(e)
        };
        b.prototype.convertToTicks = function(c) {
            return 621355968E9 + c.getTime() * 1E4
        };
        b.prototype.DownloadFile = function(c) {
            var d = c.fileUrl.indexOf("?") > -1 ? "&" : "?";
            window.open(c.fileUrl + d + this._settings.DownloadQueryStringParam + "=true")
        };
        b.prototype.IsViewSupported = function(c) {
            if (!c) return false;
            return this._settings.ViewMimeTypes.indexOf(c) >= 0
        };
        b.prototype.IsEditingAllowed = function(c) {
            if (!c) return false;
            return this._settings.EditableMimeTypes.indexOf(c) >= 0 && this._settings.IsFileEditingAllowed
        };
        b.prototype.GetDialog = function() {
            return window[this._settings.ViewDialogId]
        };
        b.prototype.HandleResultsChanges = function(c, d) {
            for (var a = this.GetControlTabs(), e = a.GetTabsCount(), g = c && c.length > 0, k = 0; k < e; k++) {
                a.SetTabEnabled(g ? k == d : true, k);
                a.SetTabToolTip(k, this.GetTooltipForTab(g ? d : k, k))
            }
        };
        b.prototype.GetTooltipForTab = function(c, d) {
            return this._settings.DisabledTabTextForPickers.filter(function(a) {
                return a.PickerIndex ===
                    c
            })[0].Tooltips.filter(function(a) {
                return a.PickerIndex === d
            })[0].Tooltip
        };
        b.prototype.GetControlTabs = function() {
            if (!this._controlTabsControl) this._controlTabsControl = j.DomElementClass.GetInstanceForElement(this._settings.ControlTabsClientId);
            return this._controlTabsControl
        };
        b.prototype.ReadFileList = function() {
            return JSON.parse(this._fileListStateHidden.val() || "[]")
        };
        b.prototype.UpdateFileListState = function(c) {
            this._fileListStateHidden.val(JSON.stringify(c))
        };
        b.prototype.UpdateFileList = function(c,
            d) {
            var a = this,
                e = this;
            c.forEach(function(k) {
                k.thumbnailUrl = e.GetFileIcon(k.name);
                a._inlineModeFileList.push(k);
                a._inlineModeFileKeys[k.id] = k;
                var l = k.name.split(".");
                if (l.length > 1) {
                    k.rawFilename = l[0];
                    if (l.length > 2)
                        for (var o = 1; o <= l.length - 2; o++) k.rawFilename += "." + l[o];
                    k.extension = "." + l[l.length - 1]
                } else k.rawFilename = k.name
            });
            if (c && c.length > 0) {
                var g = this.RenderTemplate(this._fileListItemTemplate, c, d);
                g.appendTo(this._filesContainer);
                d && DropDownMenu.initialize();
                g.find("." + this._settings.ViewActionCssClass).filter(function() {
                    var k =
                        e.GetFileByKey($(this).data("filekey"));
                    return !e.IsViewSupported(k.type)
                }).closest("li").hide();
                g.find("." + this._settings.EditActionCssClass).filter(function() {
                    var k = e.GetFileByKey($(this).data("filekey"));
                    return !e.IsEditingAllowed(k.type)
                }).closest("li").hide()
            }
        };
        b.prototype.RenderTemplate = function(c, d, a) {
            if (!c) return $();
            c = c({
                files: d,
                delayMenuInit: a
            });
            if (c instanceof $) return c;
            return $(this._templatesContainer).html(c).children()
        };
        b.prototype.GetFileIcon = function(c) {
            c = c.substring(c.indexOf(".") +
                1);
            if (this._settings.FileTypeIcons) return this._settings.FileTypeIcons[c] || this._settings.DefaultFileIcon
        };
        b.prototype.GetFileByKey = function(c) {
            return this._inlineModeFileKeys[c]
        };
        b.prototype.GetFilenameEditorItemSettings = function() {
            return {
                editModeEnabled: "inline",
                inlineEditorOptions: {
                    editFieldAutoWidth: false,
                    editFieldDisplayInline: true,
                    editFieldCssClass: this._settings.FileNameEditorCssClass
                }
            }
        };
        return b
    }(j.DomElementClass);
    j.FileRepoUploader = f
})(CCL || (CCL = {}));
(function(j) {
    var f = function(h) {
        function b(c, d) {
            var a = this;
            h.call(this, c, d);
            this._inputControl = $("#" + d.InputClientId);
            this._inputLabel = $("#" + d.LabelClientId);
            this._inputControl.on("keydown keyup change input propertychange", function() {
                a.NotifyResultChanged()
            });
            this.Trigger(j.PickerEvent.Initialized);
            this.GetResults() && this.NotifyResultChanged()
        }
        __extends(b, h);
        b.prototype.GetResults = function() {
            return this._inputControl.val() || this._inputLabel.text()
        };
        b.prototype.NotifyResultChanged = function() {
            var c = [],
                d = this.GetResults();
            d && c.push({
                fileUrl: d
            });
            this.Trigger(j.PickerEvent.ResultsChanged, {
                results: c
            })
        };
        return b
    }(j.ItemPickerBase);
    j.LinkPicker = f
})(CCL || (CCL = {}));
(function(j) {
    var f = function() {
        function h() {}
        h.FormatFileSize = function(b, c, d) {
            if (b >= 1048576) return (b / 1048576).toFixed(2) + " " + d;
            return (b / 1024).toFixed(2) + " " + c
        };
        return h
    }();
    j.Utils = f
})(CCL || (CCL = {}));
(function(j) {
    j.ControlTabsEvent = {
        Initialized: "ControlTabsInitialized",
        TabIndexChanged: "ControlTabsSelectedIndexChanged"
    };
    var f = function(h) {
        function b(c, d) {
            h.call(this, c);
            this._settings = d;
            this.InitControls()
        }
        __extends(b, h);
        b.prototype.SetCurrentTab = function(c) {
            this.GetCurrentTab() !== c && $(this._tabItemLinks[c]).click()
        };
        b.prototype.GetCurrentTab = function() {
            return parseInt(this._selectedTabIndexHolder.val())
        };
        b.prototype.GetTabsCount = function() {
            return this._tabItemLinks.length
        };
        b.prototype.SetTabEnabled =
            function(c, d) {
                if (c) {
                    $(this._tabItemLinks[d]).removeClass("disabled");
                    $(this._mobileSelect.find("> option")[d]).prop("disabled", false)
                } else {
                    $(this._tabItemLinks[d]).addClass("disabled");
                    $(this._mobileSelect.find("> option")[d]).prop("disabled", true)
                }
            };
        b.prototype.SetTabToolTip = function(c, d) {
            $(this._tabItemLinks[c]).attr("title", d)
        };
        b.prototype.InitControls = function() {
            var c = this;
            this._tabsList = this._elem.find("ul." + this._settings.TabsCssClass);
            this._mobileSelect = this._elem.find("select." + this._settings.TabsCssClass);
            this._selectedTabIndexHolder = this._elem.find("#" + this._settings.TabIndexHolderClientId);
            this._tabItemLinks = this._elem.find("ul > li > h2 > a");
            this._tabItemLinks.each(function(d, a) {
                c.InitTabItem(d, a)
            });
            $(this._tabItemLinks[this._settings.CurrentlySelectedTabIndex]).click();
            this.Trigger(j.ControlTabsEvent.Initialized)
        };
        b.prototype.InitTabItem = function(c, d) {
            var a = this,
                e = $(d);
            $(e.attr("href")).addClass(this._settings.TabContentCssClass).addClass(this._settings.ClearLeftCssClass).addClass(this._settings.HiddenTabCssClass);
            e.on("click", function(g) {
                a.OnTabChanged(g)
            })
        };
        b.prototype.OnTabChanged = function(c) {
            var d = this,
                a = $(c.currentTarget);
            if (a.hasClass("disabled")) return false;
            c = a.closest("li");
            a = $(a.attr("href"));
            var e = c.data("tabitemindex");
            this._tabsList.find("> li").removeClass(this._settings.ActiveTabCssClass);
            c.addClass(this._settings.ActiveTabCssClass);
            this._tabItemLinks.each(function(g, k) {
                $($(k).attr("href")).addClass(d._settings.HiddenTabCssClass)
            });
            a.removeClass(this._settings.HiddenTabCssClass);
            this._mobileSelect.prop("selectedIndex",
                e);
            this._selectedTabIndexHolder.val(e);
            this.Trigger(j.ControlTabsEvent.TabIndexChanged, {
                selectedTab: e
            });
            return false
        };
        return b
    }(j.DomElementClass);
    j.ControlTabs = f
})(CCL || (CCL = {}));
(function(j) {
    var f = function() {
        function h(b, c, d) {
            if (typeof d === "undefined") d = null;
            this._form = b;
            this._warningMessage = c;
            this._options = d;
            this._textInputs = b.find("input[type=text],textarea");
            this._checkboxesRadios = b.find("input[type=checkbox],input[type=radio]");
            this._selects = b.find("select");
            this._textInputs.each(function(a, e) {
                var g = $(e);
                g.data(h.InitialValueDataKey, g.val())
            });
            this._checkboxesRadios.each(function(a, e) {
                var g = $(e);
                g.data(h.InitialValueDataKey, g.is(":checked"))
            });
            this._selects.each(function(a,
                e) {
                var g = $(e);
                g.data(h.InitialValueDataKey, g.find(":selected").val())
            });
            this.AttachHandler();
            b.submit($.proxy(this.DetachHandler, this));
            d && d.cancelButtonId && $(document.getElementById(d.cancelButtonId)).click($.proxy(this.DetachHandler, this))
        }
        h.prototype.IsDirty = function() {
            return this._form.data(h.DirtyFormDataKey) == 1
        };
        h.prototype.SetDirty = function(b) {
            b = b ? 1 : 0;
            this._form.data(h.DirtyFormDataKey, b);
            this._form.trigger("dirtyChanged", b)
        };
        h.prototype.AttachHandler = function() {
            if (!this._isAttached) {
                var b =
                    $.proxy(this.OnBeforeUnloadHandler, this);
                $(window).on(h.EventBeforeunload, b);
                this._isAttached = true
            }
        };
        h.prototype.DetachHandler = function() {
            if (this._isAttached) {
                var b = $.proxy(this.OnBeforeUnloadHandler, this);
                $(window).off(h.EventBeforeunload, b);
                this._isAttached = false
            }
        };
        h.prototype.OnBeforeUnloadHandler = function() {
            var b = this.IsDirty();
            b || this._textInputs.each(function(c, d) {
                var a = $(d);
                if (a.is(":visible") && a.val() != a.data(h.InitialValueDataKey)) {
                    b = true;
                    return false
                }
            });
            b || this._checkboxesRadios.each(function(c,
                d) {
                var a = $(d);
                if (a.is(":visible") && a.is(":checked") != a.data(h.InitialValueDataKey)) {
                    b = true;
                    return false
                }
            });
            b || this._selects.each(function(c, d) {
                var a = $(d);
                if (a.is(":visible") && a.find(":selected").val() != a.data(h.InitialValueDataKey)) {
                    b = true;
                    return false
                }
            });
            this.SetDirty(b);
            if (b) return this._warningMessage
        };
        h.EventBeforeunload = "beforeunload";
        h.InitialValueDataKey = "InitialValue";
        h.DirtyFormDataKey = "IsDirty";
        return h
    }();
    j.FormCheckBeforeUnload = f
})(CCL || (CCL = {}));