const keys = require('./keys');

// Express app setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express(); // object to recieve and respond to HTTP requests
app.use(cors());       // Cross origin resource sharing (one domain to different domain request)
app.use(bodyParser.json()); // parse incoming request from React, turn body into json value


// Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    databse: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});
// error watcher
pgClient.on('error', () => console.log('Lost PG connection'));

// Initial table creation 
pgClient.query('CREATE TABLE IF NOT EXISTS values(number INT)') // table called values, column of number type INT
        .catch((err) => console.log(err));

// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();



// Express route handlers
app.get('/', (req, res) => {
    res.send('hi');
});

app.get('/values/all', async (req, res) => {
    const values = await pgClient.query('SELECT * from values');

    res.send(values.rows);
});

app.get('/values/current', async (req, res) => {     // redis doesn't have await support, use callbacks
    redisClient.hgetall('values', (err, values) => { // hgetall is get all values in hash set
        res.send(values);
    });
});

app.post('/values', async (req, res) => {
    const index = req.body.index;
    if (parseInt(index) > 40) {
        return res.status(422).send('Index too high for recursive computation');
    }

    redisClient.hset('values', index, 'Nothing yet!');
    redisPublisher.publish('insert', index); // wake up worker process to calc fib value
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]); // store index in postgres
    
    res.send({working: true});

});


app.listen(5000, err => {
    console.log('listening on 5000');
});


