var jsface       = require('jsface'),
	Globals      = require('./Globals'),
	log          = require('./Logger'),
	_und         = require('underscore'),
	path         = require('path'),
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
        Globals.requestJSON.requests.forEach(function(part, index, theArray) {
            if (part.id === request.id)
            {
                theArray[index].responses.push(
                    {
                        "responseCode": {
                            "code": response.statusCode,
                            "name": "",       // TODO: Fill these guys later on
                            "detail": ""
                        },
                        "time" : response.stats.timeTaken,
                        "headers" : response.headers,
                        "text" : response.body,
                        "language" : "javascript",
                        "id" : guid(),
                        "name" : request.name,
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
			var exportVariable = this._createExportVariable();
			var filepath = path.resolve(Globals.outputFile);
			fs.writeFileSync(filepath , JSON.stringify(exportVariable, null, 4));
			log.note("\n\n Output Log: " + filepath + "\n");
		}
        if (Globals.collectionFile) {
            console.log(Globals.collectionFile);
            Globals.requestJSON.id = guid();
            var filepath = path.resolve(Globals.collectionFile);
            fs.writeFileSync(filepath, JSON.stringify(Globals.requestJSON, null, 4));
        }
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
