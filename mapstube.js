var fs    = require('fs');
var url   = require('url');
var http  = require('http');


function displaySearch (res, pathname) {
    var search = pathname.split('/')[2];
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
        search = 'foo%3A' + search;
    }
    var opts = {
        host: 'gdata.youtube.com',
        port: 80,
        path: spath,
        method: 'GET'
    };
    http.request(opts, function (resb) {
        resb.pipe(res);
    }).end();
}


http.createServer(function (req, res) {
    var pathname = url.parse(req.url).pathname;
    console.log('GET_' + pathname);
    if (/^\/search\/[a-z0-9\.\:\+\"\%\,\;\|\>\<\_\-\!\?\[\]\(\)\\\/]+\/$/i.test(pathname)) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        return displaySearch(res, pathname);
    }
    if (pathname === '/snowstorm.js') {
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        return fs.createReadStream('./snowstorm.js').pipe(res);
    }
    if (pathname === '/favicon.ico') {
        res.writeHead(200, {'Content-Type': 'image/x-icon'});
        return fs.createReadStream('./favicon.ico').pipe(res);
    }
    res.writeHead(200, {'Content-Type': 'text/html'});
    return fs.createReadStream('./index.html').pipe(res);
}).listen(process.env.PORT || 3000);
