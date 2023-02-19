function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

const token = getCookie('token')
console.log(window.location.host)
const socket = new WebSocket("ws://" + window.location.host + "/people")

let recieved_people = new Set()
let people_strings = []
let seen = new Set()

socket.onopen = () => {
    socket.send(token);
}

socket.onclose = () => {
    console.log("the stupid server closed the connection on me :(")
    document.getElementsByTagName('body')[0].innerHTML = ""
}

function render_people()
{
    document.getElementById("patients").innerHTML = ""
    for (let i = 0; i < people_strings.length; i++)
    {
        if (seen.has(i))
            continue
        document.getElementById("patients").innerHTML += "<li>" + people_strings[i] + " <button onclick='seen.add(" + i + "); render_people()'>Seen</button></li>"
    }
}

socket.onmessage = e => {
    console.log('Message from server:', e.data)
    if (e.data.length == 0)
        return;
    let people = e.data.split("#")

    for (let i = 0; i < people.length / 2; i++)
    {
        if (!recieved_people.has(people[i * 2] + people[i * 2 + 1]))
        {
            recieved_people.add(people[i * 2] + people[i * 2 + 1])
            people_strings.push(people[i * 2] + ": " + people[i * 2 + 1])
        }
    }

    render_people()
}
