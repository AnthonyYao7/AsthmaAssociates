const express = require('express')
const app = express()
const expressWs = require('express-ws')(app)
const port = 8000

const bodyParser = require('body-parser')
const path = require('path')
const pug = require('pug')
const sha1 = require('sha1')
const cookies = require('cookie-parser')
const {v4: uuidv4} = require('uuid')
const fs = require('fs')
const { subtle } = require("node:crypto").webcrypto

app.use(express.static('waitingroom'))
app.use(bodyParser.urlencoded({extended: true}))
app.use(cookies())

app.set('view engine', 'pug')
app.set('views', './views')


function read_file(fp) { return fs.readFileSync(fp, 'utf-8').trim() }

function read_token() { return read_file('credentials/token.txt') }

function save_token(token) { fs.writeFileSync('credentials/token.txt', token) }

function read_salt() { return read_file('credentials/salt.txt') }

function read_password() { return read_file('credentials/password.txt') }

function get_date_string()
{
    const date_ob = new Date();

    const date = ("0" + date_ob.getDate()).slice(-2);
    const month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    const year = date_ob.getFullYear();
    return date + month + year;
}

function get_time_string()
{
    const d = new Date()
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2);
}

function get_daily_people() {
    /*
    check if a csv file for the day already exists
    if it does exist, read the people from it
    otherwise: there are no people
     */
    var filename = "people_data/" + get_date_string() + ".csv"

    if (fs.existsSync(filename))
        return fs.readFileSync(filename, 'utf-8')
            .split("\n")
            .map(x => x.trim()).map(x => x.split(",")).slice(1)
    else {
        return [];
    }
}

function write_daily_people(people)
{
    var filename = "people_data/" + get_date_string() + ".csv"
    let current_time = get_time_string()

    if (fs.existsSync(filename))
        fs.appendFileSync(filename, people.map((e, i) => [current_time, e]).join("\n") + "\n")
    else
        fs.writeFileSync(filename, "time,name\n" + people.map((e, i) => [current_time, e]).join("\n") + "\n")
}

function stringify_people(people)
{
    let ret = ""

    for (let i = 0; i < people.length; i++)
        ret += (people[i][0] !== "" ? people[i].join("#") + "#" : "")

    return ret.slice(0, ret.length - 1)
}

// user routes
{
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'waitingroom/waitingroom.html'))
    })

    app.post('/checkin', (req, res) => {
        write_daily_people([req.body['name'].replaceAll(",", "")])
        let people = stringify_people(get_daily_people())

        let clients = Array.from(expressWs.getWss().clients)

        for (let i = 0; i < clients.length; i++)
        {
            clients[i].send(people)
        }

        res.sendFile(path.join(__dirname, 'waitingroom/submitted.html'))
    })
}

// admin routes

/*
admin page
 - check if has token cookie
   * if it does, check if there has been a token created already
     * if there is no token, not authenticated
     * if there is, authenticated
   * if there is no cookie
     * not authenticated
 - if not authenticated, show login page
 - if authenticated, show people

 */

app.get('/admin', (req, res) => {
    if (!(read_token() === "" || read_token() === undefined)) {
        if (req.cookies["token"] === read_token())
            res.render('admin', {'authenticated': true})
        else
            res.sendFile(path.join(__dirname, 'waitingroom/404.html'));
    }
})

app.get('/login', (req, res) => {
    if (!(read_token() === "" || read_token() === undefined)) {
        if (req.cookies["token"] === read_token())
            res.render('login', {'authenticated': true, 'wrong_password': false})
        else
            res.render('login', {'authenticated': false, 'wrong_password': false})
    }
    else
        res.render('login', {'authenticated': false, 'wrong_password': false})
})


function _arrayBufferToBase64( buffer ) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}


function str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

function importPrivateKey(pem) {
    // fetch the part of the PEM string between header and footer
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = pem.substring(pemHeader.length, pem.length - pemFooter.length);
    // base64 decode the string to get the binary data
    const binaryDerString = atob(pemContents);
    // convert from a binary string to an ArrayBuffer
    const binaryDer = str2ab(binaryDerString);

    return subtle.importKey(
        "pkcs8",
        binaryDer,
        {
            name: "RSA-PSS",
            hash: "SHA-256",
        },
        true,
        ["sign"]
    );
}



app.post('/login', (req, res) => {
    const received = req.body['password'];

    const salt = read_salt();
    const temp = sha1(received + salt);
    let token = "";

    if (temp === read_password()) // correct password
    {
        if (read_token() === "")
        {
            token = uuidv4()
            save_token(token)
        }
        else
            token = read_token()

        res.cookie('token', token, {
            maxAge: 86400 * 1000 * 365 * 20,
            httpOnly: false,
            secure: false
        })
        res.render('login', {'authenticated': true, 'wrong_password': false})
    }
    else // wrong password
        res.render('login', {'authenticated': false, 'wrong_password': true})
})

app.ws("/people", (ws, req) => {
    ws.id = uuidv4()
    ws.verified = false

    ws.on('message', (msg) => {
        if (ws.verified)
        {
            console.log("Message recieved from client id: " + ws.id)
            console.log(msg)
        }
        else
        {
            // ensure client socket has sent the correct token.
            // meant to prevent just any socket connection from accessing patient names
            if (msg === read_token())
            {
                ws.verified = true
                let people = stringify_people(get_daily_people())
                ws.send(people)
            }
            else
                ws.close()
        }
    })
})


app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, 'waitingroom/404.html'));
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

