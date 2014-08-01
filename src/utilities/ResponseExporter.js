var jsface       = require('jsface'),
	Globals      = require('./Globals'),
	log          = require('./Logger'),
	_und         = require('underscore'),
	path         = require('path'),
    builder      = require('xmlbuilder'),
	fs           = require('fs');

/**
 * Generates a GUID string.
 * @returns {String} The generated GUID.
 * @example af8a8416-6e18-a307-bd9c-f2c947bbb3aa
 * @author Slavik Meltser (slavik@meltser.info).
 * @link http://slavik.meltser.info/?p=142
 */
function guid() {
    function _p8(s) {
        var p = (Math.random().toString(16)+"000000000").substr(2,8);
        return s ? "-" + p.substr(0,4) + "-" + p.substr(4,4) : p ;
    }
    return _p8() + _p8(true) + _p8(true) + _p8();
}

/**
 * @class ResponseExporter
 * @classdesc Class Used for exporting the generated responses.
 */
var ResponseExporter = jsface.Class({
	$singleton: true,

	_results: [],
	/**
	 * Adds the Reponse to the Result Array.
	 * @param {Object} request Request we got from Newman.
	 * @param {Object} response Response we got from Newman.
	 * @param {Object} tests Test Results.
	 * @memberOf ResponseExporter
	 */
	addResult: function(request, response, tests) {
		var result = this._findResultObject(request);
		if (result) {
			this._appendToResultsObject(result, request, response, tests);
		} else {
			result = this._createResultObject(request, response, tests);
			this._results.push(result);
		}
	},

	// Used to create a first result object, to be used while exporting the results.
	_createResultObject: function(request, response, tests) {
		if (!tests) {
			tests = {};
		}
        var failed = Object.keys(tests).some(function(test) { return !tests[test]});
        var baseName = failed ? "FAIL:" : "PASS:";
        for (var variable in Globals.currentIteration.dataFileVars) {
            baseName += "[" + variable + ":" + Globals.currentIteration.dataFileVars[variable] + "]";
        }

        Globals.requestJSON.requests.forEach(function(part, index, theArray) {
            if (part.id === request.id)
            {
                if (failed && !theArray[index].name.startsWith("FAIL:")) {
                    theArray[index].name = "FAIL:" + theArray[index].name;
                }

                theArray[index].responses.push(
                    {
                        "responseCode": {
                            "code": response.statusCode,
                            "name": "",       // TODO: Fill these guys later on
                            "detail": ""
                        },
                        "time" : response.stats.timeTaken,
                        "headers" : Object.keys(response.headers).map(function(header) {
                            return {
                                "name" : header,
                                "key" : header,
                                "value" : response.headers[header],
                                "description" : ""
                            }
                        }),
                        "text" : response.body,
                        "language" : "javascript",
                        "id" : guid(),
                        "name" : baseName,
                        "request" : {
                            "url" : request.transformed.url,
                            "data" : request.transformed.data,
                            "headers" : request.transformed.headers,
                            "method" : request.method,
                            "dataMode" : request.dataMode
                        }
                    }
                );
            }
        });
        if (!Globals.currentIteration.results.hasOwnProperty(request.folderName))
        {
            Globals.currentIteration.results[request.folderName] = [];
        }

        Globals.currentIteration.results[request.folderName].push(
            {
                "request" : {
                    "url" : request.transformed.url,
                    "data" : request.transformed.data,
                    "headers" : request.transformed.headers,
                    "method" : request.method,
                    "dataMode" : request.dataMode
                },
                "name": request.name,
                "url": request.transformed.url,
                "responseCode": {
                    "code": response.statusCode,
                    "name": "",       // TODO: Fill these guys later on
                    "detail": ""
                },
                "responseBody" : response.body,
                "responseHeaders" : response.headers,
                "tests": tests,
                "testPassFailCounts": this._extractPassFailCountFromTests(tests),
                "time": response.stats.timeTaken,
                "timestamp": request.startTime / 1000
            }
        );
		return {
			"id": request.id,
			"name": request.name,
			"url": request.transformed.url,
			"totalTime": response.stats.timeTaken,
			"responseCode": {
				"code": response.statusCode,
				"name": "",       // TODO: Fill these guys later on
				"detail": ""
			},
            "responseBody" : response.body,
            "responseHeaders" : response.headers,
			"tests": tests,
			"testPassFailCounts": this._extractPassFailCountFromTests(tests),
			"times": [],			// Not sure what to do with this guy
			"allTests": [tests],
			"time": response.stats.timeTaken
		};
	},

	_findResultObject: function(request) {
		return _und.find(this._results, function(result) {
			return result.id === request.id;
		}) || null;
	},

	_appendToResultsObject: function(result, request, response, tests) {
		var newResultObject = this._createResultObject(request, response, tests);
		newResultObject.totalTime += result.totalTime;
		newResultObject.allTests = newResultObject.allTests.concat(result.allTests);
		this._results[this._results.indexOf(result)] = newResultObject;
	},

	// Creates a pass, fail object for a given test.
	_extractPassFailCountFromTests: function(tests) {
		return _und.reduce(_und.keys(tests), function(results, key) {
			results[key] = {
				pass: tests[key] ? 1 : 0,
				fail: tests[key] ? 0 : 1
			};
			return results;
		}, {});
	},

    /**
	 * This function when called creates a file with the JSON of the results.
	 * @memberOf ResponseExporter
	 */
	exportResults: function() {
		if (Globals.outputFile) {
			var filepath = path.resolve(Globals.outputFile);
			fs.writeFileSync(filepath , JSON.stringify(Globals.iterations, null, 4));
			log.note("\n\n Output Log: " + filepath + "\n");
		}
        if (Globals.collectionFile) {
            console.log(Globals.collectionFile);
            Globals.requestJSON.id = guid();
            var filepath = path.resolve(Globals.collectionFile);
            fs.writeFileSync(filepath, JSON.stringify(Globals.requestJSON, null, 4));
        }
        fs.writeFileSync("junit.xml", this._createJunitXml(Globals.iterations))
	},

    getFailedTests: function (result) {
        return Object.keys(result.tests).filter(function (test) {
            return !result.tests[test]
        }).join();
    }, _createJunitXml: function(iterations) {
        // creates a Document object with root "<report>"
        var doc = builder.create("testsuite");


        Globals.iterations.forEach(function(iteration) {
            for (var folder in iteration.results) {

                var testCase = doc.ele("testcase");
                testCase.att("classname",iteration.collectionName);
                var baseName = (folder === "root") ? iteration.collectionName : folder;
                for (var variable in iteration.dataFileVars) {
                    baseName += "[" + variable + ":" + iteration.dataFileVars[variable] + "]";
                }
                testCase.att("name", baseName);
                var results = iteration.results[folder];
                testCase.att("time", results.reduce(function (x, y) { return x + y.time }, 0) / 1000 );
                var failingResults = results.filter(function(result) {
                    return Object.keys(result.tests).some(function(test) { return !result.tests[test]})
                });
                if (failingResults.length > 0) {
                    var failureElement = testCase.ele("failure");

                    var firstFailure = failingResults[0];
                    var errorMessage = this.getFailedTests(firstFailure) + ":" + firstFailure.responseCode.code + ":" + firstFailure.responseBody + "--" + failingResults.map(function (result) {
                        return this.getFailedTests(result)
                    }).join();
                    failureElement.att("message", errorMessage);
                    failureElement.txt(failingResults.map(function(result) {return JSON.stringify(result, null, 2)}).join("\n"));
                }

                var systemOut = testCase.ele("system-out");
                systemOut.txt(results.map(function(result) {return JSON.stringify(result, null, 2)}).join("\n"));
            }
        });
        return doc;
    },
	_createExportVariable: function() {
		return {
			id: '',
			name: 'Default',
			timestamp: new Date().getTime(),
			collection_id: Globals.requestJSON.id,
			folder_id: 0,
			target_type: 'collection',
			environment_id: Globals.envJson.id,
			count: Globals.iterationNumber - 1,
			collection: Globals.requestJSON,
			folder: null,
			globals: Globals.globalJSON,
			results: this._results,
			environment: Globals.envJson,
			delay: 0,
			synced: Globals.requestJSON.synced
		};
	}
});

module.exports = ResponseExporter;
