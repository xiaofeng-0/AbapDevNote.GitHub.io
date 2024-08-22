sap.ui.define([
    "sap/ui/core/routing/History"
], function (
    History
) {
    "use strict";

    return {
        /**
         * @param {sap.ui.core.mvc.Controller} oController
         */
        init: function (oController) {
            this._oController = oController;
            this._oRouter = sap.ui.core.UIComponent.getRouterFor(oController);
            this.i18n = oController.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        /**
         * 国际化文本取值
         * @type {sap.base.i18n.ResourceBundle}
         */
        i18n: null,

        /**
         * 转圈等待，执行多步操作的时候，全部都解锁才真正解锁
         */
        lock: function () {
            this._iLockCount = this._iLockCount || 0;
            this._iLockCount += 1;
            if (this._iLockCount > 0)
                sap.ui.core.BusyIndicator.show(0);
        },

        /**
         * 解锁
         */
        unlock: function () {
            this._iLockCount = this._iLockCount || 0;
            this._iLockCount -= 1;
            if (this._iLockCount < 1)
                sap.ui.core.BusyIndicator.hide();
        },

        /**
         * 转跳
         **/
        navTo: function (sPath, oParam) {
            this._oRouter.navTo(sPath, oParam);
        },

        /**
         * Navigates back in the browser history, if the entry was created by this app.
         * If not, it navigates to a route passed to this function.
         *
         * @public
         * @param {string} [sRoute] the name of the route if there is no history entry
         * @param {object} [mData] the parameters of the route, if the route does not need parameters, it may be omitted.
         * @param {boolean} [bReplace] defines if the hash should be replaced (no browser history entry) or set (browser history entry)
         */
        navBack: function (sRoute, mData, bReplace) {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();
            var oCrossAppNavigator = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService("CrossApplicationNavigation");
            if (typeof (sPreviousHash) !== "undefined") {
                // The history contains a previous entry
                history.go(-1);
            } else {
                if ((sRoute === "" || typeof (sRoute) === "undefined") && oCrossAppNavigator) {
                    // Navigate back to FLP home
                    oCrossAppNavigator.toExternal({
                        target: {
                            shellHash: "#"
                        }
                    });
                } else {
                    // Otherwise we go backwards with a forward history
                    if (typeof (bReplace) === "undefined") {
                        bReplace = true;
                    }
                    this.onNavTo(sRoute, mData, bReplace);
                }
            }
        },

        /**
         * addEventListener这个名称不太准确，核心代码是装饰模式
         */
        addEventListener: function (obj, event, fn) {
            if (obj[event]) {
                var fnOri = obj[event];
                obj[event] = function () {
                    fnOri.apply(this, arguments);
                    if (fn) fn.apply(this, arguments); // 放fnOri前后是个问题
                }.bind(obj);
                obj[event]["_fnOri"] = fnOri;
            } else {
                obj[event] = fn;
            }
        },

        /**
         * addEventListener的逆向操作
         */
        removeEventListener: function (obj, event) {
            if (obj[event]) {
                if (obj[event]["_fnOri"]) {
                    obj[event] = obj[event]["_fnOri"];
                } else {
                    delete obj[event];
                }
            }
        },

        /**
         * 进度条
         * @param {Object} oParameters
         * @param {Array<*>} oParameters.array
         * @param {Number} oParameters.size
         * @param {function} oParameters.step
         * @param {function} oParameters.async_step
         * @param {sap.m.$ProgressIndicator} [oParameter.progress]
         * @param {sap.m.$DialogSettings} [oParameter.dialog]
         */
        progress: function (oParameters) {
            // 进度条设置
            var progressSetting = Object.assign({
                percentValue: 0,
                displayValue: `${0}/${oParameters.array.length}`,
                showValue: true,
                displayAnimation: false,
                state: "Information"
            }, oParameters.progress);
            var oProgressIndicator = new sap.m.ProgressIndicator(progressSetting);
            // 弹窗设置
            var oDialogSetting = Object.assign({
                content: oProgressIndicator,
                showHeader: false,
                resizable: false,
                verticalScrolling: false,
                contentWidth: "80%",
                type: "Message"
            }, oParameters.dialog);
            var oDialog = new sap.m.Dialog(oDialogSetting);
            // 启动弹窗
            oDialog.open();
            // 尾递归处理
            var fnFinish;
            var fnClose = function () {
                oDialog.close();
                sap.ui.core.BusyIndicator.hide(); // 隐藏转圈
                if (fnFinish)
                    fnFinish();
            };
            var fn = async function (nCurr) {
                // 更新进度条
                oProgressIndicator.setPercentValue((nCurr / oParameters.array.length) * 100);
                oProgressIndicator.setDisplayValue(`${nCurr}/${oParameters.array.length}`);
                // 边界
                if (nCurr === oParameters.array.length) {
                    fnClose();
                    return;
                }
                // 切分数据
                var aItems = oParameters.array.slice(nCurr, nCurr + oParameters.size);
                var bLast = ((nCurr + aItems.length) === oParameters.array.length);
                // 异步函数的情况
                if (oParameters.async_step) {
                    oParameters.async_step(aItems, bLast)
                        .then(() => fn(nCurr + aItems.length))
                        .catch(() => fnClose());
                    return;
                }
                // 同步函数的情况
                if (oParameters.step)
                    oParameters.step(aItems, bLast);
                return fn(nCurr + aItems.length);
            };
            // Promise形式返回
            return new Promise(function (resolve) {
                fnFinish = resolve;
                sap.ui.core.BusyIndicator.show(0); // 转圈等待
                fn(0);
            });
        }
    };
});