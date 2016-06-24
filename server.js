//const auth = require('basic-auth');
const express = require('express');
//const cfenv = require('cfenv');
const app = express();
//const appEnv = cfenv.getAppEnv();

var cors = require('cors');

// uncomment this to allow all CORS domains
//app.use(cors());

var cloudant;
var db;

var dbCredentials = {
		dbName : 'super-activities-db'
	};

var lastCredsUsed = '';

	
function initDBConnection() {
	
	if (process.env.VCAP_SERVICES) {
		var vcapServices = JSON && JSON.parse(process.env.VCAP_SERVICES) || $.parseJSON(process.env.VCAP_SERVICES);
//		JSON.parse(process.env.VCAP_SERVICES);
		// Pattern match to find the first instance of a Cloudant service in
		// VCAP_SERVICES. If you know your service key, you can access the
		// service credentials directly by using the vcapServices object.
		for (var vcapService in vcapServices){
			if (vcapService.match(/cloudantNoSQLDB/i)){
				// I am going to my primary site
				dbCredentials.host = vcapServices[vcapService][0].credentials.host;
				dbCredentials.port = vcapServices[vcapService][0].credentials.port;
				dbCredentials.user = vcapServices[vcapService][0].credentials.username;
				dbCredentials.password = vcapServices[vcapService][0].credentials.password;
				dbCredentials.url = vcapServices[vcapService][0].credentials.url;
				
				cloudant = require('cloudant')(dbCredentials.url);
				
				// check if DB exists if not create
//				cloudant.db.create(dbCredentials.dbName, function (err, res) {
//					if (err) { console.log('could not create db ', err); }
//				});
				
				db = cloudant.use(dbCredentials.dbName);
//				console.log('using cloudant database ', dbCredentials.dbName);
				console.log('using cloudant database from service ', vcapServices[vcapService][0].name);
				break;
			} else if (vcapService.match(/user-provided/i)){
				// I am going to my backup site
				dbCredentials.host = vcapServices[vcapService][0].credentials.host;
				dbCredentials.port = vcapServices[vcapService][0].credentials.port;
				dbCredentials.user = vcapServices[vcapService][0].credentials.username;
				dbCredentials.password = vcapServices[vcapService][0].credentials.password;
				dbCredentials.url = vcapServices[vcapService][0].credentials.url;
				
				cloudant = require('cloudant')(dbCredentials.url);
				
				// check if DB exists if not create
//				cloudant.db.create(dbCredentials.dbName, function (err, res) {
//					if (err) { console.log('could not create db ', err); }
//				});
				
				db = cloudant.use(dbCredentials.dbName);
//				console.log('using cloudant database ', dbCredentials.dbName);
				console.log('using cloudant database from service ', vcapServices[vcapService][0].name);
				break;
			}
		}
		if(db==null){
			console.warn('Could not find Cloudant credentials in VCAP_SERVICES environment variable - data will be unavailable to the UI');
		}
	} else {
		console.warn('VCAP_SERVICES environment variable not set - only development data will be available to the UI');
		// For running this app locally you can get your Cloudant credentials 
		// from Bluemix (VCAP_SERVICES in "cf env" output or the Environment 
		// Variables section for an app in the Bluemix console dashboard).
		// Alternately you could point to a local database here instead of a 
		// Bluemix service.
		
		// from the DEV creds
		dbCredentials.host = "ed939949-f653-4827-80d7-b337bff5fdbc-bluemix.cloudant.com";
		dbCredentials.port = 443;
		dbCredentials.user = "ed939949-f653-4827-80d7-b337bff5fdbc-bluemix";
		dbCredentials.password = "39ed55d43de58e4027705af1b65c1f30e5039e3a41a930655f3498ec382a6586";
		dbCredentials.url = "https://ed939949-f653-4827-80d7-b337bff5fdbc-bluemix:39ed55d43de58e4027705af1b65c1f30e5039e3a41a930655f3498ec382a6586@ed939949-f653-4827-80d7-b337bff5fdbc-bluemix.cloudant.com";
		cloudant = require('cloudant')(dbCredentials.url);
		db = cloudant.use(dbCredentials.dbName);
	}		
}


var whitelist = ['https://super-activities-dev.mybluemix.net', 'http://super-activities-dev.mybluemix.net', 'http://localhost:4500'];

// Asynchronous CORS	
var corsOptionsDelegate = function(req, callback){
	  var corsOptions;
	  if(whitelist.indexOf(req.header('Origin')) !== -1){
	    corsOptions = { origin: true }; // reflect (enable) the requested origin in the CORS response 
	  }else{
	    corsOptions = { origin: false }; // disable CORS for this request 
	  }
	  callback(null, corsOptions); // callback expects two parameters: error and options 
};
	
// Dynamic CORS	
var corsOptions = {
		 origin: function(origin, callback){
			    var originIsWhitelisted = whitelist.indexOf(origin) !== -1;
			    callback(null, originIsWhitelisted);
		 }
};
	
app.get("/api/activities", cors(corsOptionsDelegate), function(req, res, next) {
// app.get("/api/activities", cors(corsOptions), function(req, res, next) {

	/*
	var responseData = { 
			total_rows: 3,
			offset:0,
			rows: [
			    {
			    	id: "Basketball",
			    	description: "A description of basketball",
			    	points:75
			    },
			    {
			    	id: "Bowling",
			    	description: "A description of bowling",
			    	points:40
			    },
			    {
			    	id: "Darts",
			    	description: "A description of darts",
			    	points:35
			    },			    
			]
	}
	*/
	var responseData = {};
	// Initialize to blank
	responseData.total_rows = 0;
	responseData.offset = 0;
	responseData.rows = [];
	
	console.log("Get method invoked.. ")
	
	db = cloudant.use(dbCredentials.dbName);
//	var docList = [];
	var i = 0;
	db.list(function(err, body) {
		if (!err) {
			var len = body.rows.length;
			console.log('total # of docs -> '+len);
			if (len == 0) {
				// send empty response back
			} else {
				// we have rows back
				responseData.total_rows = len;
				responseData.offset = 0;
				body.rows.forEach(function(document) {
					// get the document
					db.get(document.id, { revs_info: true }, function(err, doc) {
						if (!err) {
							responseData.rows.push({});
							responseData.rows[i].id = doc._id;
							responseData.rows[i].description = doc.description;
							responseData.rows[i].points = doc.points;
							i++;
							if(i >= len) {
								console.log('ending response...');
								res.send(responseData);
							}
						} else {
							console.log(err);
						}
					});			
				});
			}		
		} else {
			console.log(err);
		}
	});
});

app.get("/", function(req, res) {

	res.send({
		result: "This is the super-activity-server"
	});
});


initDBConnection();
var server_port = process.env.VCAP_APP_PORT || 3000;
var server_host = process.env.VCAP_APP_HOST || "localhost";

var server = app.listen(server_port, server_host, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log("super-activity-server app listening at http://%s:%s", host, port);
});