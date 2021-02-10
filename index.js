app.get('/statement-bca', function (req, res) {
   let today     = new Date();
   let yesterday = new Date(today);
   yesterday.setDate(today.getDate() - 14);

   let _today_month = ('0' + (today.getMonth() + 1)).slice(-2);
   let _today_date  = ('0' + today.getDate()).slice(-2);

   let _yesterday_month = ('0' + (yesterday.getMonth() + 1)).slice(-2);
   let _yesterday_date  = ('0' + yesterday.getDate()).slice(-2);
   
   let today_date     = today.getFullYear()+'-'+_today_month+'-'+_today_date;
   let yesterday_date = yesterday.getFullYear()+'-'+_yesterday_month+'-'+_yesterday_date;
 
    let account   = process.env.ACCOUNT;
    let startDate = req.query.startDate || yesterday_date;
    let endDate   = req.query.endDate || today_date;
 
    var promise = new Promise(function(resolve,reject){
       let base64 = Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64');
 
       // CALL API TOKEN
       fetch(process.env.API_URL_BCA + "api/oauth/token", {
          "headers": {
            "authorization": `Basic ${base64}`,
            "content-type": 'application/x-www-form-urlencoded',
         },
          "body": "grant_type=client_credentials",
          "method": "POST",
       }).then(response => response.json()
       ).then(data => {
       console.log(data)
          console.log(`Get Access Token [${data.access_token}]`)
          console.log(data)
          resolve(data);
       }).catch(error => {
          reject(error)
       });
    });
 
    promise.then(function(value){
       let token       = value.access_token;
       let httpMethod  = 'GET';
       let today       = new Date();
       let timeStamp   = today.toISOString();
       let requestBody = sha256.create();
       let relativeUrl = '/banking/v3/corporates/'+process.env.CORPORATE+'/accounts/'+account+'/statements?EndDate='+endDate+'&StartDate='+startDate;
 
       headers = {
          'Timestamp'   : timeStamp,
          'URI'         : relativeUrl,
          'AccessToken' : token,
          'APISecret'   : process.env.BCA_API_SECRET,
          'HTTPMethod'  : httpMethod
       }
 
       var promiseSign = new Promise(function(resolve, reject) {
          // CALL API SIGNATURE
          fetch(process.env.API_URL_BCA + "utilities/signature", {
             "headers"   : headers,
             "method"    : "POST",
          })
          .then(response => response.text())
          .then(data => {
            //  console.log(`BCA GET ${relativeUrl}`)
            //  console.log(data)
             resolve(data);
          })
          .catch(error => {
             reject(error)
          });
       });
 
       promiseSign.then(function(value){
          requestBody.update('');
          requestBody.hex();
 
          let StringToSign =
             httpMethod +
             ':' +
             relativeUrl +
             ':' +
             token +
             ':' +
             requestBody +
             ':' +
             timeStamp;
 
          let signature = sha256.hmac(process.env.BCA_API_SECRET, StringToSign);
          
          headers = {
             'Content-Type'    : 'application/json',
             Authorization     : `Bearer ${token}`,
             Origin            : process.env.DOMAIN,
             'X-BCA-Key'       : process.env.BCA_API_KEY,
             'X-BCA-Timestamp' : timeStamp,
             'X-BCA-Signature' : signature
          };
 
          // CALL API STATEMENT
          fetch(process.env.API_URL_BCA+'banking/v3/corporates/'+process.env.CORPORATE+'/accounts/'+account+'/statements?EndDate='+endDate+'&StartDate='+startDate, {
             "headers": headers,
             "method": "GET",
          }).then(response => response.json()
          ).then(data => {
             if (data.ErrorCode) {
                res.send({
                   status   : "error",
                   response : data
                });
                console.log(`BCA GET ${relativeUrl} ERROR CODE ${data.ErrorCode}`)
                console.log('Response Body ' + JSON.stringify(data))
                return;
             }
 
             let arrayBCA = data.Data;
             

            res.send({
              status           : "success",
              data_transaction : arrayBCA
            });

            return;
          });
       });
 
    }, function(reason){
          res.send({
             status  : "error",
             result  : reason
          });
          return
    });
 
 });
