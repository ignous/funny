var net = require('net'),
  port = 8888;

function frist_data(client){
  var buffer = new Buffer(0);

  client.on('data', function(data){
    buffer = buffer_add(buffer, data);
    if(buffer_find_body(buffer) === -1) return;
    var req = parse_request(buffer);
    if(req === false) return;
    client.removeAllListeners('data');
    relay_connection(req, buffer, client);
  })
}


net.createServer(function (client){
  frist_data(client);
}).listen(port);

console.log('Proxy server running at localhost:'+port);

//处理各种错误
process.on('uncaughtException', function(err){
    console.log("\nError!!!!");
    console.log(err);
});

function relay_connection(req, buffer, client){
  console.log(req.method + ' ' + req.host + ':' + req.port);

  if(req.method != 'CONNECT'){
    var _body_pos = buffer_find_body(buffer);
    if(_body_pos < 0) _body_pos = buffer.length;
    var header = buffer.slice(0, _body_pos).toString('utf8');
    header = header.replace(/(proxy\-)?connection\:.+\r\n/ig, '')
      .replace(/Keep\-Alive\:.+\r\n/i, '')
      .replace('\r\n', '\r\nConnection: close\r\n');

    if(req.httpVersion == '1.1'){
      var url = req.path.replace(/http\:\/\/[^\/]+/, '');
      if(req.path != url) header = header.replace(req.path, url);
    }
    buffer = buffer_add(new Buffer(header, 'utf8'), buffer.slice(_body_pos));
  }


  var server = net.createConnection(req.port, req.host);

  client.on('data', function(data){ server.write(data);});
  server.on('data', function(data){ client.write(data);});


  if(req.method == 'CONNECT'){
    client.write(new Buffer('HTTP/1.1 200 Connection established\r\nConnection: close\r\n\r\n'));
  }else{
    server.write(buffer);
  }
}

/**
* 从请求头部取得请求详细信息
* 如果是 CONNECT 方法，那么会返回 { method,host,port,httpVersion}
* 如果是 GET/POST 方法，那么返回 { metod,host,port,path,httpVersion}
*/
function parse_request(buffer){
  var s = buffer.toString('utf8');
  var method = s.split('\n')[0].match(/^([A-Z]+)\s/)[1];
  if(method == 'CONNECT'){
    var arr = s.match(/^([A-Z]+)\s([^\:\s]+)\:(\d+)\sHTTP\/(\d\.\d)/);
    if(arr && arr[1] && arr[2] && arr[3] && arr[4]){
      return { method: arr[1], host: arr[2], port: arr[3], httpVersion: arr[4]}
    }
  }else{
    console.log(s);
    var arr = s.match(/^([A-Z]+)\s([^\s]+)\sHTTP\/(\d\.\d)/);
    if(arr && arr[1] && arr[2] && arr[3]){
      var host = s.match(/Host\:\s+([^\n\s\r]+)/)[1];
      if(host){
        var _p = host.split(':', 2);
        return { method: arr[1], host: _p[0], port: _p[1]?_p[1]:80, path: arr[2], httpVersion: arr[3]};
      }
    }
  }
  return false;
}



function buffer_add(buf1, buf2){
  var re = new Buffer(buf1.length + buf2.length);
  buf1.copy(re);
  buf2.copy(re, buf1.length);
  return re;
}

/**
* 从缓存中找到头部结束标记("\r\n\r\n")的位置
*/
function buffer_find_body(b){
  for(var i=0,len=b.length-3;i<len;i++)    {
    if (b[i] == 0x0d && b[i+1] == 0x0a && b[i+2] == 0x0d && b[i+3] == 0x0a)        {
      return i+4;
    }
  }
  return -1;
}