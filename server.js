import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

import { v4 as uuidv4 } from 'uuid';
import redisConnect from './utils/redisConnect.js';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';
import { OAuth2Client } from 'google-auth-library';
import googlePhoneLib from 'google-libphonenumber';

import {addCustomer, searchCustomer, exactMatchFields, partiallyMatchFields} from './services/customerService.js';
import {addTrip, getTrip, updateTrip, updateTripFields, searchTrip, exactMatchTripFields, partiallyMatchTripFields} from './services/tripService.js';
import {saveTokens,getTokens} from './services/oAuthCodeService.js';

import {parsePhone} from './utils/phoneUtil.js';

import cors from 'cors';

// use pattern and code from: https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code

const client = new OAuth2Client(//the below details came from https://console.cloud.google.com under Credentials
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET, 
  process.env.GOOGLE_REDIRECT_URI
);//the google auth client verifies the token signature and calls Google to get a refresh token

//load .env environment variables
dotenv.config();

const adminUsers = JSON.parse(process.env.ADMIN_USERS);
const redisClient =  await redisConnect();

const phoneUtil = googlePhoneLib.PhoneNumberUtil.getInstance();
const PNF = googlePhoneLib.PhoneNumberFormat;

// create express app
const app = express();
//web portal
app.use(express.static('public'));
// Setup server port
const port = process.env.PORT || 3001;

//control which urls can call the backend
app.use(cors({
  origin:['http://localhost:3000','https://reservations-test.mustangbus.com','https://reservations.mustangbus.com'],
  credentials:true//if we don't set this, it won't allow cookies to be passed to the backend from the frontend
}))

// parse requests of content-type - application/json
app.use(bodyParser.json());

//parse requests for cookie
app.use(cookieParser());

//cookie
app.use(async (req, res, next) => {
  req.roles=[];//initialize the roles the user has to an empty array
  // check if client sent cookie
  var cookie = req.cookies.oAuthCode;

  if(req.url=="/api/running"){//don't require authentication on healthchecks
    next();
  }
  else if (cookie === undefined) {//we only allow them to fetch the login page before logging in
    res.status(401);
    res.send("no cookie")
  } else {
    try{

    let refreshToken = "";
    let idToken = "";
    if(req.url=="/api/token"){  // first time they used the oAuth code - just logging in OR verifying token
      ({refreshToken,idToken} = await getTokens({redisClient, oAuthCode:cookie}));
      
      if (!refreshToken || ! idToken){//we haven't seen this oAuth code previously, we need to get tokens
        const {tokens:{id_token,access_token,refresh_token}} = await  client.getToken(cookie);      
        refreshToken = refresh_token;
        idToken = id_token;
        await saveTokens({redisClient,oAuthCode:cookie,refreshToken, idToken});
      }
    } else{
      ({refreshToken,idToken} = await getTokens({redisClient, oAuthCode:cookie}));
    }

    // client.refreshAccessToken();

    client.setCredentials({
      refresh_token:refreshToken
    });//this authorizes the client

    
    const newAccessToken = await client.getAccessToken();//this gets a new token in case the old one has expired

    const tokenInfo = await client.getTokenInfo(newAccessToken.token);
    /**
     * 
      access_type:'offline'
      aud:'257921541428-mj6719g80bei7sqe6dshso09v3nn99m3.apps.googleusercontent.com'
      azp:'257921541428-mj6719g80bei7sqe6dshso09v3nn99m3.apps.googleusercontent.com'
      email:'smurdock@mustangbus.com'
      email_verified:'true'
      exp:'1705090508'
      expiry_date:1705090507756
     */


    const now = Date.now();
    const tokenExpired= now > tokenInfo.expiry_date;
    const userId = tokenInfo.email;
    const emailParts = userId.split('@');
    const domain = emailParts[1];
  
    if(domain=='mustangbus.com' && tokenInfo.email_verified=='true' && ! tokenExpired){
      req.emailAddress=userId;
      req.roles.push('driver');

      if (adminUsers.includes(userId)) {
        req.roles.push('admin');//these are admin users
      }
    }

    // yes, cookie was already present 
    req.email = userId;//add this to the request so we can ensure responses are filtered appropriately

    next();
    } catch (error){
      res.status(403);
      res.send("Token Invalid");
      console.error(error);
    }
  }
});

app.post('/api/customers',async (req,res)=>{
  let customer = req.body;

  let responseStatus = (customer.firstName && customer.lastName && customer.phoneNumber && (customer.companyName || ! customer.contract) && customer.email && customer.contract!=null) ? 200 : 400;
  let response = "";

  if (responseStatus==200){
    try{
    customer.phoneNumber = parsePhone(customer.phoneNumber);
    
    const existingCustomersByPhone = await searchCustomer({redisClient,query:{phoneNumber:customer.phoneNumber},isTag:true,key:'phoneNumber'});
    const existingCustomersByEmail = await searchCustomer({redisClient,query:{email:customer.email},isTag:true,key:'email'});

    if(existingCustomersByPhone.length>0 || existingCustomersByEmail.length>0){
      responseStatus=409;//existing customer already
    }
    else {
      await addCustomer({redisClient,customer});
  
    }
    } catch (error){
      res.status(500);
    }
  } else{
    res.send(`Missing one of the following fields: ${exactMatchFields()} ${partiallyMatchFields()}`);
  }
  res.status(responseStatus);
  res.send();
})

app.get('/api/customers/search', async(req,res)=>{
  let response="";
  const keys = Object.keys(req.query);
  if(keys.length==0 || keys.length>1){
      res.status(400);
      response = "Only one query field is allowed";
  }

  const key = keys[0];

  const isTag = exactMatchFields().includes(key);
  const isText = partiallyMatchFields().includes(key);

  if (!isTag && !isText){
    res.status(400);
    response=`${key} is not an available query field`
  } else{
    response = await searchCustomer({redisClient,query:req.query,key,isText,isTag});
  }
  res.send(response);
})


// define a root route
app.get('/api/running', (req, res) => {
  res.send('Server Running');
});

app.listen(port, async () => {
  console.log(`Server is listening on port ${port} now`);
});

app.get('/api/token', async(req,res)=>{
  res.status(200);
  res.send(JSON.stringify({emailAddress:req.emailAddress,roles:req.roles?req.roles:[]}));
});


// Endpoint to create a new trip
app.post('/api/trips', async (req, res) => {
  let trip = req.body;
  // trip details -- todo deal with contractCustomer
  let responseStatus = (trip.firstName && trip.lastName && trip.email && trip.phoneNumber && trip.quoteDate && trip.groupName && trip.groupPhone && trip.groupLeader && trip.numOfPassengers && trip.pickupLocation && trip.destination && trip.departureDate && trip.returnDate && trip.departureTime && trip.returnTime && trip.estimatedMileage && trip.taxRate!=null && trip.invoiceItems && trip.invoiceItems.length > 0) ? 200 : 400;
  if (responseStatus === 200) {
    try {
      trip.phoneNumber = parsePhone(trip.phoneNumber);
      // addTrip function to handle trip creation in the database
      await addTrip({ redisClient, trip });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
      return;
    }
  } else{
    res.status(responseStatus);
    res.send(`Missing one of the following fields: ${exactMatchTripFields()} ${partiallyMatchTripFields()}`);
  }
  res.status(responseStatus).send();
});

// Endpoint to update specific fields of a trip
app.put('/api/trips', async (req, res) => {
  let trip = req.body;
  // trip details -- todo deal with contractCustomer
  let responseStatus = (trip.firstName && trip.lastName && trip.email && trip.phoneNumber && trip.quoteDate && trip.groupName && trip.groupPhone && trip.groupLeader && trip.numOfPassengers && trip.pickupLocation && trip.destination && trip.departureDate && trip.returnDate && trip.departureTime && trip.returnTime && trip.estimatedMileage && trip.taxRate!=null && trip.invoiceItems && trip.invoiceItems.length > 0) ? 200 : 400;
  if (responseStatus === 200) {
    try {
      trip.phoneNumber = parsePhone(trip.phoneNumber);
      // addTrip function to handle trip creation in the database
      await updateTrip({ redisClient, trip });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
      return;
    }
  } else{
    res.status(responseStatus);
    res.send(`Missing one of the following fields: ${exactMatchTripFields()} ${partiallyMatchTripFields()}`);
  }
  res.status(responseStatus).send();
});

// Endpoint to patch a trip
app.patch('/api/trips', async (req, res) => {
  let trip = req.body;

  // trip details -- todo deal with contractCustomer
  let responseStatus = trip.phoneNumber && (trip.signature || trip.acceptDate || trip.firstName || trip.lastName || trip.email || trip.companyName  || trip.quoteDate || trip.groupName || trip.groupPhone || trip.groupLeader || trip.numOfPassengers || trip.pickupLocation || trip.destination || trip.departureDate || trip.returnDate || trip.departureTime || trip.returnTime || trip.estimatedMileage || trip.taxRate!=null && trip.invoiceItems && trip.invoiceItems.length > 0) ? 200 : 400;
  if (responseStatus === 200) {
    try {
      trip.phoneNumber = parsePhone(trip.phoneNumber);
      // addTrip function to handle trip creation in the database
      await updateTripFields({ redisClient, trip });//this function will add a tripId for a new draft
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
      return;
    }
  } else{
    res.status(responseStatus);
    res.send(`Missing one of the following fields: ${exactMatchTripFields()} ${partiallyMatchTripFields()}`);
  }
  res.status(responseStatus).send();
});
 

// // Endpoint to search for a trip
app.get('/api/trips/search', async (req, res) => {
  let response = "";
  let isTag = false;
  let isText = false;


  // Check the number of query parameters
  const keys = Object.keys(req.query);
  const key = keys[0];
  if (keys.length != 1) {
    res.status(400);
    response = "You must provide only one query field";
  } else {
    // Check if each key is a valid query field
    const validKeys = keys.every(key => {
      isTag = exactMatchTripFields().includes(key);
      isText = partiallyMatchTripFields().includes(key);
      return isTag || isText;
    });

    if (!validKeys) {
      res.status(400);
      response = "One or more provided query fields are not valid";
    } else {
      // Call the search function for trips
      try{
        response = await searchTrip({ redisClient, query: req.query, key, isText });
      } catch (error){
        res.status(400);
        response = "Error searching for trip";
        console.log(`Error searching for ${key}: ${error}`);
      }
    }
  }

  res.send(response);
});

app.post('/api/invoice/:tripId', async(req,res)=>{
  //TO-DO: we must retrieve the Quickbooks Access token and Realm ID  from the environment (.env file)

  //TO-DO: we must call the POST invoice Quickbooks endpoint to create an invoice

  //TO-DO: we must retrieve the payment url from the quickbooks response and return it to the frontend

  res.send({
    paymentURL:""
  })
})

app.get('/api/trips/:tripId', async (req,res)=>{
  const tripId=req.params.tripId;
  const trip = await getTrip({redisClient, tripId});
  res.json(trip);
}); 