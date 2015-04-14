/* jshint node: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, nonew: true, quotmark: double, strict: true, undef: true, unused: true */
/***************************************
 * CPSC473 Section 1 - Assignment 8
 * Eric Donaldson + Kyle Meyerhardt
 * Bit.ly/Tinyurl clone using MongoDB/Mongoose
 * References:
 * Previous Assignments, and our group projects
 * http://getbootstrap.com/
 * http://redis.io/topics/quickstart
 * http://www.sitepoint.com/using-redis-node-js/
 * https://lodash.com/ - "_"
 * https://www.npmjs.com/package/validator - "validator"
 * https://www.npmjs.com/package/string-hash - modified version exists in index.js
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toString
 * http://mongoosejs.com/docs/3.8.x/docs/api.html
 * http://blog.modulus.io/getting-started-with-mongoose
 */
var express = require("express");
var router = express.Router();

var utility = {
    stringHash: function (str) {
        "use strict";
        // Based on http://www.cse.yorku.ca/~oz/hash.html
        // from NPM module string-hash https://www.npmjs.com/package/string-hash
        // sourcecode avail: https://github.com/darkskyapp/string-hash and tweaked with ideas from
        // And converting to base 36 at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toString
        var hash = 5381,
            i = str.length;

        while (i){
            hash = (hash * 33) ^ str.charCodeAt(--i);
        }

        return (hash >>> 0).toString(36);
    }
};

/* GET home page. */
router.get("/", function (req, res, next) {
    "use strict";
    res.render("index", {title: "CPSC473-Assignment8 URL Shortner"});
});

/* POST new url to database */
router.post("/submit", function (req, res, next) {
    "use strict";
    // Get posted data
    var path = req.body.path;
    // Validate URL, found validator module in NPM
    if (!validator.isURL(path, {
            require_protocol: true,
            host_blacklist: ["127.0.0.1"]
        }) && validator.isURL("http://" + path, {
            require_protocol: true,
            host_blacklist: ["127.0.0.1"]
        })) {
        path = "http://" + path;
    }
    // Alternate validation could be to perform header check against the URL to confirm the host is real.
    if (validator.isURL(path, {require_protocol: true, host_blacklist: ["127.0.0.1"]})) {
        // Hash the url string
        var hash = utility.stringHash(path);
        var fullHost = "http://" + req.headers.host + "/";
        var Db = mongoose.model("data", hashSchema);
        if(path.substring(0,(fullHost.length)) !== fullHost) { // Check if begins with hostname
            var insert = new Db({
                hash: hash,
                url: path
            });
            insert.save();
            res.json({shortURL: "http://" + req.headers.host + "/" + hash});
        } else { // Begins with hostname, return the long URL
            var hashBreak = path.substring((fullHost.length),path.length);
            Db.findOne({hash: hashBreak},function (err, result) {
                console.log({result:result,type:typeof result});
                if(result !== null) {
                    res.json({shortURL: result.url});
                } else {
                    res.json({"error": "Bad shortcode lookup"});
                }
            });
        }
    } else { // Return that URL was bad
        res.json({"error": "URL is considered invalid"});
    }
});

/* Couple quick API points */
router.get("/new10", function (req, res, next) {
    "use strict";
    var db = mongoose.model("data",hashSchema);
    // Load the full list of newest entries. This list is always trimmed to 10 items so shouldn"t be a need to restrict this call too
    db.find({}).select("hash url -_id").sort({"date":-1}).limit(10).exec(function (err, newIds) {
//        console.log({func:"new10",err:err,newIds:newIds});
        res.json(_.map(newIds,function(entry){ return [entry.hash,entry.url];}));
//        console.log(newIds);
    });
});
router.get("/top10", function (req, res, next) {
    "use strict";
    var db = mongoose.model("data",hashSchema);
    // Load top 10 entries in sorted count list, to prevent race conditions on updating the sort list, we retain all counts in this key
    db.find({count: {$gt: 0}}).select("hash url -_id").sort({"count":-1}).limit(10).exec(function (err, topIds) {
//        console.log({func:"top10",err:err,topIds:topIds});
//        console.log(_.map(topIds,function(entry){ return [entry.hash,entry.url];}));
        res.json(_.map(topIds,function(entry){ return [entry.hash,entry.url];}));
    });
});

/* Handle invalid hash paths */
router.get("/notfound", function (req, res, next) {
    "use strict";
    // Just display page saying not found, but give user ability to submit links here too
    res.render("notfound", {title: "CPSC473-Assignment8 URL Key Not Found"});
});

/* Catch all other URI"s and process them */
router.all("/:hash", function (req, res, next) {
    "use strict";
    var hash = req.params.hash;
    var db = mongoose.model("data",hashSchema);
    // Look up hash in redis
    db.findOne({ hash: hash}, function (err, result) {
        // If hash is not in database for some reason
        if (err === null && result !== null) {
//            console.log({func:"url-hash",err:err,result:result});
            // Increment hit counter because result was found
//            console.log(result);
            result.update({$inc: {count: 1}},{},function(){});
            result.save();
            // Forward user to URL
            res.redirect(result.url);
        } else {
            // If not found, redirect to notfound
            res.redirect("/notfound");
        }
    });
});

module.exports = router;
