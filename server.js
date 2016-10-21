const whitelistedFields = [
    'nickname',
    'sex',
    'language',
    'province',
    'city',
    'country',
    'headimgurl',
    'privilege'
];

const serviceName = WeChat.serviceName;
const serviceVersion = 2;
const serviceUrls = null;
const serviceHandler = function (query) {
    var config = ServiceConfiguration.configurations.findOne({ service: serviceName });
    if (!config)
        throw new ServiceConfiguration.ConfigError();

    var response = getTokenResponse(config, query);

    const expiresAt = (+new Date) + (1000 * parseInt(response.expiresIn, 10));
    const {accessToken, scope, openId, unionId} = response;
    var user = Meteor.users.findOne({ 'wechat.unionId': unionId })
    let id
    switch (config.mainId) {
        case 'unionId':
            id = unionId
            break;
        case 'openId':
            id = unionId
            break;
        default:
            id = user._id
            break;
    }
    let serviceData = {
        accessToken,
        expiresAt,
        openId,
        unionId,
        scope,
        id: id // id is required by Meteor
    };

    // only set the token in serviceData if it's there. this ensures
    // that we don't lose old ones
    if (response.refreshToken)
        serviceData.refreshToken = response.refreshToken;

    var identity = getIdentity(accessToken, openId);
    var fields = _.pick(identity, whitelistedFields);
    _.extend(serviceData, fields);

    return {
        serviceData: serviceData,
        options: {
            profile: fields
        }
    };
};

var getTokenResponse = function (config, query) {
    var response;
    try {
        //Request an access token
        response = HTTP.get(
            "https://api.weixin.qq.com/sns/oauth2/access_token", {
                params: {
                    code: query.code,
                    appid: config.appId,
                    secret: OAuth.openSecret(config.secret),
                    grant_type: 'authorization_code'
                }
            }
        );
        if (response.error) // if the http response was an error
            throw response.error;
        if (typeof response.content === "string")
            response.content = JSON.parse(response.content);
        if (response.content.error)
            throw response.content;

    } catch (err) {
        throw _.extend(new Error("Failed to complete OAuth handshake with WeChat. " + err.message),
            { response: err.response });
    }

    return {
        accessToken: response.content.access_token,
        expiresIn: response.content.expires_in,
        refreshToken: response.content.refresh_token,
        scope: response.content.scope,
        openId: response.content.openid,
        unionId: response.content.unionid
    };
};

var getIdentity = function (accessToken, openId) {
    try {
        var response = HTTP.get("https://api.weixin.qq.com/sns/userinfo", {
            params: { access_token: accessToken, openid: openId, lang: 'zh-CN' }
        }
        );
        if (response.error) // if the http response was an error
            throw response.error;
        if (typeof response.content === "string")
            return JSON.parse(response.content);
        if (response.content.error)
            throw response.content;
    } catch (err) {
        throw _.extend(new Error("Failed to fetch identity from WeChat. " + err.message),
            { response: err.response });
    }
};

// register OAuth service
OAuth.registerService(serviceName, serviceVersion, serviceUrls, serviceHandler);

// retrieve credential
WeChat.retrieveCredential = function (credentialToken, credentialSecret) {
    return OAuth.retrieveCredential(credentialToken, credentialSecret);
};

Accounts.addAutopublishFields({
    forLoggedInUser: _.map(
        // why not publish openId and unionId?
        whitelistedFields.concat(['accessToken', 'expiresAt']), // don't publish refresh token
        function (subfield) { return 'services.' + serviceName + '.' + subfield; }
    ),

    forOtherUsers: _.map(
        whitelistedFields,
        function (subfield) { return 'services.' + serviceName + '.' + subfield; })
});