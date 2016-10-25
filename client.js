const serviceName = WeChat.serviceName;

// Request WeChat credentials for the user
// @param options {optional}
// @param credentialRequestCompleteCallback {Function} Callback function to call on
//   completion. Takes one argument, credentialToken on success, or Error on
//   error.
WeChat.requestCredential = function (options, credentialRequestCompleteCallback) {
    // support both (options, callback) and (callback).
    if (!credentialRequestCompleteCallback && typeof options === 'function') {
        credentialRequestCompleteCallback = options;
        options = {};
    } else if (!options) {
        options = {};
    }

    var config = ServiceConfiguration.configurations.findOne({service: serviceName});
    if (!config) {
        credentialRequestCompleteCallback && credentialRequestCompleteCallback(
            new ServiceConfiguration.ConfigError()
        );
        return;
    }

    var credentialToken = Random.secret();
    var scope = (options && options.requestPermissions) || ['snsapi_login'];
    scope = _.map(scope, encodeURIComponent).join(',');
    var loginStyle = OAuth._loginStyle(serviceName, config, options);
    var state = OAuth._stateParam(loginStyle, credentialToken, options.redirectUrl);

    var loginUrl =
        'https://open.weixin.qq.com/connect/qrconnect' +
        '?appid=' + config.appId +
        '&redirect_uri=' + OAuth._redirectUri(serviceName, config, null, {replaceLocalhost: true}) +
        '&response_type=code' +
        '&scope=' + scope +
        '&state=' + state +
        '#wechat_redirect';

    OAuth.launchLogin({
        loginService: serviceName,
        loginStyle: loginStyle,
        loginUrl: loginUrl,
        credentialRequestCompleteCallback: credentialRequestCompleteCallback,
        credentialToken: credentialToken
    });
};

Meteor.loginWithWeChat = function(options, callback) {
    // support a callback without options
    if (! callback && typeof options === "function") {
        callback = options;
        options = null;
    }

    var credentialRequestCompleteCallback = Accounts.oauth.credentialRequestCompleteHandler(callback);
    WeChat.requestCredential(options, credentialRequestCompleteCallback);
};