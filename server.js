
// this is where I listen for junk to process
var SUBSCRIBE_TOPIC = "activity/backend/output";
	
// this is where I publish my data to
var PUBLISH_TOPIC = "activity/server/output";

var SHARE_ID = "node-activity-server";

var mqlightServiceName = "mqlight";

var mqlight = require('mqlight');

/*
 * Establish MQ credentials
 */
var opts = {};
var mqlightService = {};
if (process.env.VCAP_SERVICES) {
  var services = JSON.parse(process.env.VCAP_SERVICES);
  console.log( 'Running BlueMix');
  if (services[ mqlightServiceName ] == null) {
    throw 'Error - Check that app is bound to service';
  }
  mqlightService = services[mqlightServiceName][0];
  opts.service = mqlightService.credentials.connectionLookupURI;
  opts.user = mqlightService.credentials.username;
  opts.password = mqlightService.credentials.password;
} else {
  opts.service = 'amqp://localhost:5672';
}

/*
 * Create our MQ Light client
 * If we are not running in Bluemix, then default to a local MQ Light connection  
 */
var mqlightSubInitialised = false;
var mqlightClient = mqlight.createClient(opts, function(err) {
  if (err) {
    console.error('Connection to ' + opts.service + ' using client-id ' + mqlightClient.id + ' failed: ' + err);
  } else {
    console.log('Connected to ' + opts.service + ' using client-id ' + mqlightClient.id);
  }
  /*
   * Create our subscription
   */
  mqlightClient.on('message', processBackendMessage);
  mqlightClient.subscribe(SUBSCRIBE_TOPIC, SHARE_ID, 
    {credit : 1,
      autoConfirm : false,
      qos : 1}, function(err) {
        if (err) console.error("Failed to subscribe: " + err); 
        else {
          console.log("Subscribed");
          mqlightSubInitialised = true;
        }
      });
});


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
		dbName : 'super-activities-db',
		serviceNameInUse : 'No service instance defined'
	};

var lastCredsUsed = '';

var savedRes;
var savedResponseData = {};
var savedI;

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
				dbCredentials.serviceNameInUse = vcapServices[vcapService][0].name;
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
				dbCredentials.serviceNameInUse = vcapServices[vcapService][0].name;
				console.log('using cloudant database from replica service: ', vcapServices[vcapService][0].name);
				break;
			}
		}
		if(db==null){
			console.warn('Could not find Cloudant credentials in VCAP_SERVICES environment variable - data will be unavailable to the UI');
		}
	} else {
		console.warn('VCAP_SERVICES environment variable not set - only development data will be available to the UI from US replica');
		// For running this app locally you can get your Cloudant credentials 
		// from Bluemix (VCAP_SERVICES in "cf env" output or the Environment 
		// Variables section for an app in the Bluemix console dashboard).
		// Alternately you could point to a local database here instead of a 
		// Bluemix service.
		
		// from the DEV creds
		dbCredentials.host = "7e7c529c-4cd4-4ea7-94df-b106120c45c2-bluemix.cloudant.com";
		dbCredentials.port = 443;
		dbCredentials.user = "7e7c529c-4cd4-4ea7-94df-b106120c45c2-bluemix";
		dbCredentials.password = "080eabbb75c2d4b7554ee6ce01e49c8f0bbac6ad806449c8d686bff9b1298578";
		dbCredentials.url = "https://7e7c529c-4cd4-4ea7-94df-b106120c45c2-bluemix:080eabbb75c2d4b7554ee6ce01e49c8f0bbac6ad806449c8d686bff9b1298578@7e7c529c-4cd4-4ea7-94df-b106120c45c2-bluemix.cloudant.com";
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
								console.log('Start to talk to backend...' + mqlightClient.id);
								// Talk to back end here, or, set flag that one is done and check for both down
							    var msgData = {
							    	"message" : "This is a message from the Activity Server",
							    	"activityserver" : "Node.js: " + mqlightClient.id
							    };
							    console.log("Sending message: " + JSON.stringify(msgData));
							    mqlightClient.send(PUBLISH_TOPIC, msgData, {
							    	    ttl: 60*60*1000 /* 1 hour */
							    });							
//								res.send(responseData);
							    savedResponseData = responseData;
							    savedRes = res;
							    savedI = i;
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

app.get("/config", function(req, res) {

	if (process.env.VCAP_APPLICATION) {
		res.send(process.env.VCAP_APPLICATION);		
	} else {
		res.send({
			result: "No VCAP_APPLICATION provided, must be running local"
		});
	}
});

app.get("/", function(req, res) {

	const imAliveMessage = "This is the super-activity-server running against Cloudant service: " + dbCredentials.serviceNameInUse;
	res.send({
		result: imAliveMessage
	});
});


function processBackendMessage(data, delivery) {
	  try {
	    data = JSON.parse(data);
	    console.log("Received response: " + JSON.stringify(data));
	  } catch (e) {
	    // Expected if we're receiving a Javascript object
	  }
//	  heldMsg = {"data" : data, "delivery" : delivery};
	  if ( savedRes ) {
		  // lets try to complete the initial request
			savedResponseData.rows.push({});
			savedResponseData.rows[savedI].id = "Backend Work";
			savedResponseData.rows[savedI].description = "Work from activity backend server";
			savedResponseData.rows[savedI].points = 100;
//			msg.delivery.message.confirmDelivery();
			delivery.message.confirmDelivery();
			console.log('ending initial request response...' + mqlightClient.id);
			savedRes.send(savedResponseData);	
			// clear saved
			savedI = 0;
			savedRes = '';
			saveResponseData = {};		
	  } else {
		  // not my message to send back
		  console.log("Not my message: " + mqlightClient.id);
	  }	  
}



initDBConnection();
var server_port = process.env.VCAP_APP_PORT || 3000;
var server_host = process.env.VCAP_APP_HOST || "localhost";

var server = app.listen(server_port, server_host, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log("super-activity-server app listening at http://%s:%s", host, port);
});