const server_public_key =
    "-----BEGIN PUBLIC KEY-----\n" +
    "MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA3FNsCUKyHtfcbV1DCxPY\n" +
    "8ggaDtuKgHMBCCEa9LXWcwa98nDSa0DOxZlHXAV1NKAMUXiw94lnICvH2m3tZB1k\n" +
    "JCaH+TGIXoC7jwkUI6KzthauJn7sIfrCuyhExmwy6o2ia3MSfgRJHYSfaTVFcna9\n" +
    "baSZ1Ss4tG9Hj/74Pq04dRs7hw1IK60pnPe1dACRVyUzDMkoj6d/OxQa5BJ0p8re\n" +
    "xM0LhyQ/oTWyJQByhZvk0Xiax9znAAF7v+3i1d93fTTCmCnG6eCPmxoyy8tv/POq\n" +
    "+R8hksRHFnFn3ypM11VebSzDgLns88UKOEPlsmjwVFOYszJagqpL6ZG7an4dVtiq\n" +
    "QUS0rWpGybLjkyZ1Ua91f7hb0HhOGj5mWi/iRLgiqzp/KfL62j9tNFSzn+/UmxOg\n" +
    "GHsIoZJdX+cPpRML5PnYZb6F3cN/5EsKnNYrf4LaVavwKMGrjBL2rvhpEIUO/Zok\n" +
    "4AkZGjoNukaW4ZEcV2dT8JILx2lTqnSoBMQeBjfCAKotAgMBAAE=\n" +
    "-----END PUBLIC KEY-----\n"

function get_time_string()
{
    const d = new Date()
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2);
}

function _arrayBufferToBase64( buffer ) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}


async function get_random_hash()
{
    const array = new Uint32Array(10)
    self.crypto.getRandomValues(array)
    const number_string = array.join("")
    const encoder = new TextEncoder()
    const data = encoder.encode(number_string)
    return window.crypto.subtle.digest('SHA-256', data)
}

// $(function() { //shorthand document.ready function
//     $('#login').on('submit', function(e) { //use on if jQuery 1.7+
//         e.preventDefault();  //prevent form from submitting
//         var data = $("#password").serializeArray();
//         console.log(data); //use the console for debugging, F12 in Chrome, not alerts
//     });
// });

$(function() {
    $("#login").on('submit', function(e)
    {
        e.preventDefault()
        let password = document.getElementById("password").value
        get_random_hash().then((results) =>{
            let salt = _arrayBufferToBase64(results)
            let current_time = get_time_string()

            let ciphertext = salt + "---" + current_time + "---" + password

            // let encrypt = new JSEncrypt()
            // encrypt.setPublicKey(server_public_key)
            // let encrypted = encrypt.encrypt(ciphertext)
            let enc = new TextEncoder()
            let encoded = enc.encode(ciphertext)

            let encrypted = window.crypto.subtle.encrypt(
                {
                    name: "RSA-OAEP",
                },
                server_public_key,
                encoded
            ).then((results) => {
                $.ajax({
                    url: "/login",
                    type: "POST",
                    dataType: "json",
                    data: {"password": _arrayBufferToBase64(encrypted)},
                    success: function(result)
                    {
                        connsole.log(result)
                    },
                    error: function(result)
                    {
                        console.log(result)
                    }
                })
            })
        })
    })
})

