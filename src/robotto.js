'use strict';

const request = require('request');
const url = require('url');

let robotto = {};

robotto.getRobotsUrl = function(urlP) {
    let receivedUrl = url.parse(urlP);
    return `${receivedUrl.protocol}\/\/${receivedUrl.host}/robots.txt`;
};

robotto.fetch = function(urlP, callback) {
    callback = typeof callback === 'function' ? callback : new Function();

    let robotsUrl = this.getRobotsUrl(urlP);

    request.get(robotsUrl, (err, res, body) => {
        if (err) {
            callback(err);
            return;
        }

        if (res.statusCode !== 200) {
            callback(new Error(`Could not fetch robots.txt from ${urlP}. Server response code: ${res.statusCode}`));
            return;
        }

        callback(null, body);
    });
};

robotto.parse = function(robotsFile) {
    let lines = robotsFile.split('\n');
    let rulesObj = {
        userAgents: {},
        comments: []
    };
    let lastUserAgent;

    lines.forEach((line) => {
        let hashIndex = line.indexOf('#');

        if (hashIndex > -1) {
            if (hashIndex === 0) {
                // entire line commentary
                rulesObj.comments.push(line.substr(hashIndex + 1).trim());
                return;
            }

            // portion line comment
            let portions = line.split('#');

            rulesObj.comments.push(portions[1].trim()); // push comment
            line = portions[0].trim(); // exclude comment from line
        }

        let userAgentIndex = line.toLowerCase().indexOf('user-agent:');
        if (userAgentIndex === 0) {
            lastUserAgent = line.split(':')[1].trim();
            rulesObj.userAgents[lastUserAgent] = {
                allow: [],
                disallow: []
            };
            return;
        }

        let allowIndex = line.toLowerCase().indexOf('allow:');
        if (allowIndex === 0) {
            rulesObj.userAgents[lastUserAgent].allow.push(line.split(':')[1].trim());
            return;
        }

        rulesObj.userAgents[lastUserAgent].disallow.push(line.split(':')[1].trim());
        return;
    });

    return rulesObj;
};

robotto.check = function(userAgent, urlParam, rulesObj) {
    let userAgents = Object.keys(rulesObj.userAgents);
    let rules = rulesObj.userAgents;
    let desiredRoute = (url.parse(urlParam).pathname + '/').split('/')[1];
    let allowed = true;

    // Searches for every user agent until it gets a match
    // The 'return true' statements are used to break the .some() loop
    userAgents.some((agent) => {
        if (agent === userAgent) {
            // Check if route is disallowed
            let disallowedRoutes = rules[agent].disallow;
            disallowedRoutes.some((route) => {
                if (desiredRoute === route.split('/')[1]) {
                    allowed = false;
                    return true;
                  } else if (route === '/') {
                    allowed = false;
                    return true;
                }
            });
            return true;
        }
    });

    // Checks the general rules
    if (userAgents.indexOf('*') !== -1) {
        let allDisallowedRoutes = rules['*'].disallow;
        allDisallowedRoutes.some((route) => {
            if (desiredRoute === route.split('/')[1]) {
                allowed = false;
                return true;
            } else if (route === '/') {
                allowed = false;
                return true;
            }
        });
    }

    return allowed;
};

robotto.canCrawl = function(userAgent, urlParam, callback) {
    callback = typeof callback === 'function' ? callback : new Function();

    this.fetch(urlParam, (err, robotsTxt) => {
        if (err) {
            callback(err);
            return;
        }

        let rules = this.parse(robotsTxt);
        let canCrawl = this.check(userAgent, urlParam, rules);
        callback(null, canCrawl);
    });
};

module.exports = robotto;
