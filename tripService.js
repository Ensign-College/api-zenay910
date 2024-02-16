// create a customer key using the client phone number, get the customer if already exists in database, if customer exists use the phone number and date to create a trip key, assign trip status, payment status, and trip viewed values if they do not already exist, save the trip to the database, if the customer is not in the database throw an error.
const addTrip = async ({ redisClient, trip }) => {
    const customerKey = `customer:${trip.phoneNumber}`;
    const existingCustomer = await redisClient.json.get(customerKey);
    if (existingCustomer !== null) {
        const tripKey = `trip:${trip.phoneNumber}-${Date.now()}`;
        trip.tripStatus = trip.tripStatus ? trip.tripStatus : "Pending"; //if no status provided
        trip.paymentStatus = "Unpaid";
        trip.viewed=false;

        // Create the trip data in Redis
        await redisClient.json.set(tripKey, '$', trip);
    } else {
        throw new Error(`Customer ${customerKey} does not exist`);
    }
};

// the trip id is used as the trip key to retrieve the trip from the database, if the trip exists then the trip is updated with the details are updated, if the trip does not exist an error is thrown. 
const updateTrip = async ({ redisClient, trip }) => {
    const tripKey = `trip:${trip.tripId}`;
    const existingTrip = await redisClient.json.get(tripKey);
    if (existingTrip !== null) {
        // Update the trip data in Redis
        await redisClient.json.set(tripKey, '$', trip);
    } else {
        throw new Error(`Trip ${tripKey} does not exist`);
    }
};

// check if there is a trip id, if there is no trip id use the phone number and date for the trip id, use the trip id as the trip key and check the database for the trip key, if there is 
const updateTripFields = async ({ redisClient, trip }) => {//update only specified fields

    if(!trip.tripId){//this is in case we are getting a patch API call for a draft of a new trip
        trip.tripId= `${trip.phoneNumber}-${Date.now()}`;
    }
    const tripKey = `trip:${trip.tripId}`;
    const existingTrip = await redisClient.json.get(tripKey);
    if (existingTrip !== null) {
        delete trip.tripId;//we don't need to update this field
        // Update the trip data in Redis
        for(const field in trip){
            await redisClient.json.set(tripKey, `$.${field}`, trip[field]);
        }
    } else {
        // throw new Error(`Trip ${tripKey} does not exist`);
        // If the trip doesn't exist, add it to the database
        await redisClient.json.set(tripKey, '$', trip);
    }
};


const updateTripViewed = async ({ redisClient, tripId, viewed }) => {
    const tripKey = `trip:${tripId}`;
    const existingTrip = await redisClient.json.get(tripKey);
    if (existingTrip !== null) {

        // Update the trip data in Redis
        await redisClient.json.set(tripKey, '$.viewed', viewed==true);//has customer viewed quote?
    } else {
        throw new Error(`Trip ${tripKey} does not exist`);
    }
};

const getTrip = async ({redisClient, tripId}) =>{
    const resultObject = await redisClient.json.get(`trip:${tripId}`);
    return resultObject;
}

const searchTrip = async ({ redisClient, query, key, isText}) => {
    let value = query[key];

    // const indexName = 'idx:Trip'; // Update this with the appropriate index name for trips

    const resultObject = isText ? await redisClient.ft.search('idx:Trip', `@${key}:(${value}*)`) : await redisClient.ft.search('idx:Trip', `@${key}:{${value}}`);

    //if we are searching by a Tag (exact match) index we use {} around the query value, for example:
    //redisClient.ft.search('idx:Customer', `@email:{${emailAddress}}`)

    // if we are searching by a Text (partial match allowed) index we use () around the query value, example:
    //redisClient.ft.search('idx:Customer', `@firstName:(${firstName})`)

    return resultObject.documents.map(resultObject => ({...resultObject.value,tripId:resultObject.id.split(':')[1]}));
};

// edited code with console.log statements to find out why the get trip function isn't returning anything

// const searchTrip = async ({ redisClient, query, key, isText }) => {
//     try {
//       let value = query[key];
//       console.log('Value:', value)
//       const indexName = 'idx:Trip';
//       const queryExpression = isText
//         ? `@${key}:(${value})`
//         : `@${key}:{${value}}`;
  
//       console.log('Executing search query:', queryExpression);
  
//       const resultObject = isText
//         ? await redisClient.ft.search(indexName, queryExpression)
//         : await redisClient.ft.search(indexName, queryExpression);
  
//       console.log('Search result:', resultObject);
  
//       return resultObject.documents.map(result => result.value);
//     } catch (error) {
//       console.error('Error in searchTrip:', error);
//       throw error;
//     }
//   };

// Create Tag type indexes in Redis - requiring exact match
const exactMatchTripFields = () => {
    return [
        "quoteStatus", // Assuming a dropdown for quote status
        "paymentStatus", // Assuming a dropdown for payment status
        "tripStatus",
        "tripId"
    ];
};

// Create Text type indexes in Redis - allowing partial matching
const partiallyMatchTripFields = () => {
    return [
        "firstName",
        "lastName",
        "email",
        "groupLeader",
        "groupName",
        "phoneNumber",
        "quoteNumber",
        "companyName"
    ];
};

export { addTrip, getTrip, updateTrip, updateTripFields, searchTrip, exactMatchTripFields, partiallyMatchTripFields}