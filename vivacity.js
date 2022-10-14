var request = require('request')
var qs = require('qs')
var axios = require('axios')
const Influx = require('influx')
const fs = require('fs')
const fileContent = fs.readFileSync('countlines.txt', 'utf-8')
const rows = fileContent.split(/\r?\n/).map(line => line)

//------------- GLOBAL VARIABLES -------------

const baseurl = `https://muo-backend.its.manchester.ac.uk`
const headers = {"X-API-KEY" : "brb3-5jes-4k9f-5rcd-2t8g"}

const data = qs.stringify({
  'username': 'manchester-uni-api-user',
  'password': '}eUUF2)84' 
 });

const conf_token= {
  method: 'post',
  url: 'https://api.vivacitylabs.com/get-token',
  headers: { 
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  data : data
};

var bearer = ''

const tokenId = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1ZWRmODRjMzM5OWY1NDY4NDI2YTllYWUiLCJpYXQiOjE1OTIzMTU5ODN9.fSbS6-kLbC0AtIukITdAhKE_KV0VuEkl9cQvQkBjwxI'

//----------------------------------------------


//-------------- VIVACITY QUERIES --------------

// GET token
getToken = async () => {
  try {
    const res = await axios(conf_token)
    bearer = res.data.access_token
  }
  catch (err) {
    console.log(err.message);
  };
}

buildTimeInterval = () => {
  let timeToObj = new Date()
  const mins = timeToObj.getMinutes()
  timeToObj.setMinutes(mins - mins % 5)
  timeToObj.setSeconds(0)
  timeToObj.setMilliseconds(0)
  let timeFromObj = new Date(timeToObj)
  timeFromObj.setMinutes(timeToObj.getMinutes() - 5)
  return([timeFromObj, timeToObj])
}


// GET counts
getCounts = async (timeFromObj, timeToObj) => {
  try {
    const res = await axios({
      method: 'get',
      url: `https://api.vivacitylabs.com/counts?countline=&includeZeroCounts=true&timeFrom=${timeFromObj.toISOString()}&timeTo=${timeToObj.toISOString()}`,
      headers: { 
        'Authorization': `Bearer ${bearer}`
      }
    })
    return (res.data)
  }
  catch(err) {
    console.log(err);
    return
  }
}



main = async () => {

	const index = rows.indexOf('');
	rows.splice(index, 1)
  const platforms = JSON.parse(`{${rows.join(',')}}`)

  await getToken()
  const [timeFromObj, timeToObj] = buildTimeInterval()
  const counts = await getCounts(timeFromObj, timeToObj)

  const year = parseInt(timeToObj.getFullYear());
  const month = parseInt(timeToObj.getMonth()) + 1;
  const day = parseInt(timeToObj.getDate());
  const hours = parseInt(timeToObj.getHours());
  const minutes = parseInt(timeToObj.getMinutes());
  const seconds = parseInt(timeToObj.getSeconds());
  const weekday = parseInt(timeToObj.getDay());
  const timestamp = parseInt(timeToObj.getTime() / 1000);

  for (let i in counts) {
    if (i.toString() in platforms) {
      const class_counts = Object.values(counts[i])[0].counts
      for (let j in class_counts) {
        
        let measurement = 'vehicle-count'
        if (class_counts[j].class === 'pedestrian') measurement = 'people-count'
        
				if(class_counts[j].countIn) {
					let ref = `vivacity__${i}__${class_counts[j].class}_${platforms[i].countIn}`
		      let value = Math.round(class_counts[j].countIn)
		      
		      let newValue = {
		        measurement,
		        tags: { ref },
		        fields: {
		          value,
		          year,
		          month,
		          day,
		          hours,
		          minutes,
		          seconds,
		          weekday
		        },
		        timestamp
		      }
		      try{
			      await influx.writePoints([
		          newValue
		        ], {precision: 's'})
		      } catch (e) {
		        console.log(`ERROR ==> ${e.message}`)
		      }
				}

				if (platforms[i].countOut) {
		      ref = `vivacity__${i}__${class_counts[j].class}_${platforms[i].countOut}`
		      value = Math.round(class_counts[j].countOut)
		      let newValue = {
		        measurement,
		        tags: { ref },
		        fields: {
		          value,
		          year,
		          month,
		          day,
		          hours,
		          minutes,
		          seconds,
		          weekday
		        },
		        timestamp
		      }
		      try{
			      await influx.writePoints([
		          newValue
		        ], {precision: 's'})
		      } catch (e) {
		        console.log(`ERROR ==> ${e.message}`)
		      }
				}
      }
    }
  }
}





const influx = new Influx.InfluxDB({
  host: '172.31.6.188:8086',  // AWS internal address of muo-archive
  // host: '10.99.110.194:8086', // on-Premise (UoM)     
  database: 'mcri'
});

influx.getDatabaseNames()
.then(names => {
  if (!names.includes('mcri')) {
    console.log(`I'm gonna create the DB mrci`);
    return influx.createDatabase('mcri');
  }
  return console.log(`Found database 'mcri' in InfluxDB`);
})
.catch(error => console.log({ error }));

main()
setInterval(main, 4*60*1000);
