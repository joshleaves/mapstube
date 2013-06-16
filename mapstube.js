var mongo = require('mongodb');
var http = require('http');
var url = require('url');
var fs = require('fs');

var index;
var snowjs;
var count = { total: 0,
	      home: 0,
	      search: 0,
	      searchterms: 0,
	      searchusers: 0,
	      searchplaylists: 0,
	      stats: 0,
	      error: 0,
	      date: mD() };

fs.readFile('./index.html', function (e, data) {
    if (e) { throw e; }
    index = data;
});
fs.readFile('./snowstorm.js', function (e, data) {
	if (e) { throw e; }
	snowjs = data;

});

function mD(a) {
    var b;if (a){b=new Date(a)}else{b=new Date();}
    return b.toDateString()+' '+b.toTimeString().substring(0,8);
}

function cleanArray(a) {
    var l = a.length;
    for(var i=0; i < l; i++) {
	delete a[i]._id;
	if (typeof a[i].query != 'undefined') {
	    a[i].query = decodeURIComponent(a[i].query);
	}
	if (typeof a[i].date != 'undefined') {
	    a[i].date = mD(a[i].date);
	}
    }
    return a;
}

function displayStats(res, pathname, db) {
    var blk = 0;
    var st = {
		requests: {
	    	session: count
		}
    };

    db.collection('requests', function (e, dbb) {
	dbb.find({scope: 'forever'}, function (e, dbb) {
	    dbb.each(function (e, dbb) {
		if (blk == 1) { return; }
		st.requests.forever = {
		    total: dbb.total,
		    home: dbb.home,
		    search: dbb.search,
		    searchterms: dbb.searchterms,
		    searchusers: dbb.searchusers,
		    searchplaylists: dbb.searchplaylists,
		    stats: dbb.stats,
		    error: dbb.error
		};
		blk = 1;
		db.collection('list', function (e, dbc) {
		    dbc.find({}, {limit: 5, sort: { date: -1}}).toArray(function (e, dbc) {
			st.latest = cleanArray(dbc);
			db.collection('words', function (e, dbd) {
			    dbd.find({}, {limit: 5, sort: { count: -1}}).toArray(function (e, dbd) {
				st.top = cleanArray(dbd);
				res.writeHead(200, {'Content-Type': 'application/json'});
				res.write(JSON.stringify(st, null, '\t'));
				res.end();
			    });
			});
		    });
		});
	    });
	});
    });
    db.collection('requests', function(err, db) {
		db.update({ scope: 'session'}, { $set: { total: count.total, stats: count.stats } });
		db.update({ scope: 'forever'}, { $inc: { total: 1, stats: 1} });
    });
    count.stats++;
}

function itsSearch(path) { return (path.match(/^\/search\/[a-z0-9\.\:\+\"\%\,\;\|\>\<\_\-\!\?\[\]\(\)\\\/]+\/$/i)); }
function getSearch(pathname) { return (pathname.split('/')[2]); }
function displaySearch(res, pathname, db) {
    var search = getSearch(pathname);
    var spath, type;
    console.log('SEARCHING_FOR_'+search);
    if (search.match(/^user%3A/i)) {
    	spath = '/feeds/api/users/'+search.split('%3A')[1]+'/uploads?v=2&alt=json&location=!&orderby=published&start-index=1&max-results=50';
    	type = 'USER';
    } else if (search.match(/^playlist%3A/)) {
    	spath = '/feeds/api/playlists/'+search.split('%3A')[1]+'?v=2&alt=json&location=!&orderby=published&start-index=1&max-results=50';
    	type = 'PLAYLIST';
	} else {
    	spath = '/feeds/api/videos?v=2&alt=json&location=!&q='+search+'&orderby=relevance&start-index=1&max-results=50';
    	type = 'TERM';
    }
    console.log('SEARCHING_FOR_'+type+'_'+search.split('%3A')[1]);
    var opts = {
		host: 'gdata.youtube.com',
		port: 80,
		path: spath,
		method: 'GET'
    };
    res.writeHead(200, {'Content-Type': 'application/json'});
    var req = http.request(opts, function (resb) {
		resb.setEncoding('utf8');
		resb.on('data', function (chunk) { res.write(chunk); });
		resb.on('end', function () { res.end(); });
    });
    req.end();

    db.collection('list', function(err, db) {
		db.save({ query: search, date: new Date().getTime() });});
    	db.collection('words', function(err, db) {
			db.count({ query: search}, function (err, res) {
	    	if (res == 0) {
				db.save({ query: search, count: 1});
		    } else {
				db.update({ query: search}, { $inc: { count: 1}});
	    	}
		});
    });
    db.collection('requests', function(err, db) {
	    if (type == 'TERM') {
			db.update({ scope: 'session'}, { $set: { total: count.total, search: count.search, searchterms: count.searchterms } });
			db.update({ scope: 'forever'}, { $inc: { total: 1, search: 1, searchterms: 1} });
			count.searchterms++;
		} else if (type == 'USER') {
			db.update({ scope: 'session'}, { $set: { total: count.total, search: count.search, searchusers: count.searchusers } });
			db.update({ scope: 'forever'}, { $inc: { total: 1, search: 1, searchusers: 1} });
			count.searchusers++;
		} else if (type == 'PLAYLIST') {
			db.update({ scope: 'session'}, { $set: { total: count.total, search: count.search, searchplaylists: count.searchplaylists } });
			db.update({ scope: 'forever'}, { $inc: { total: 1, search: 1, searchplaylists: 1} });
			count.searchplaylists++;
		}
    });
    count.search++;
}

function displayHome(res, pathname, db) {
    db.collection('requests', function(err, db) {
		db.update({ scope: 'session'}, { $set: { total: count.total, home: count.home } });
		db.update({ scope: 'forever'}, { $inc: { total: 1, home: 1} });
    });
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(index);
    res.end();
    count.home++;
}



var db = new mongo.Db('mapstube',new mongo.Server('dsXXXXXX.mongolab.com', 1337, {}));
db.open(function(err, db) {
    db.authenticate('root', 'XXXXXXXX', function (err) {
	http.createServer(function (req, res) {
	    var pathname = url.parse(req.url).pathname;
	    console.log('GET_' + pathname);
	    if (pathname == '/') { displayHome(res, pathname, db); }
	    else if (pathname == '/stats/') { displayStats(res, pathname, db); }
	    else if (itsSearch(pathname)) { displaySearch(res, pathname, db); }
	    else if (pathname == '/snowstorm.js') {
	    	res.writeHead(200, {'Content-Type': 'text/javascript'});
	    	res.write(snowjs);
	    	res.end();
	    }
	    else if (pathname == '/favicon.ico') {
			res.writeHead(200, {'Content-Type': 'image/x-icon'});
			res.end('foo');
			count.total--;
	    }
	    else { displayHome(res, pathname, db); }
	    count.total++;
	}).listen(8080);
    });
});
