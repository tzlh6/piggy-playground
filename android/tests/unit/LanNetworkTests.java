package local.piggy.playground;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Real TCP/UDP integration tests; --serve exposes the same bridge for browser QA. */
public final class LanNetworkTests {
    static void check(boolean value, String why) { if (!value) throw new AssertionError(why); }
    static JSONObject await(BlockingQueue<JSONObject> q, String type) throws Exception {
        long end=System.currentTimeMillis()+9000;
        while(System.currentTimeMillis()<end){JSONObject e=q.poll(100,TimeUnit.MILLISECONDS);if(e!=null&&type.equals(e.optString("type")))return e;}
        throw new AssertionError("Missing event "+type);
    }
    static synchronized void print(JSONObject object) { System.out.println(object.toString());System.out.flush(); }
    public static void main(String[] args) throws Exception {
        if(args.length>0&&args[0].equals("--serve")){serve();return;}
        for(String host:new String[]{"8.8.8.8","example.com","0.0.0.0","192.168.1.300","127.0.0.1/abc","::1"}) {
            boolean rejected=false;try{LanNetwork.localAddress(host);}catch(IOException e){rejected=true;}check(rejected,"Reject non-LAN: "+host);
        }
        for(String host:new String[]{"192.168.1.20","10.42.0.1","172.16.0.5","169.254.1.2","127.0.0.1"})check(LanNetwork.localAddress(host)!=null,"Accept local "+host);
        BlockingQueue<JSONObject> h=new LinkedBlockingQueue<>(),c=new LinkedBlockingQueue<>(),scan=new LinkedBlockingQueue<>();
        try(ServerSocket occupied=new ServerSocket(19321);
            LanNetwork host=new LanNetwork(h::add,19320,19321);
            LanNetwork guest=new LanNetwork(c::add,19320,19321);
            LanNetwork finder=new LanNetwork(scan::add,19320,19321)) {
            JSONObject opened=host.host(new JSONObject("{\"name\":\"猪猪测试房\",\"game\":\"chess\",\"proto\":\"piggy-games/1\",\"open\":1}"));
            check(opened.optBoolean("ok")&&opened.optInt("port")==19322,"Occupied port fallback");
            check(opened.optBoolean("discovery"),"UDP responder");finder.scan(true);
            JSONObject rooms=await(scan,"rooms");check(rooms.getJSONArray("list").length()>0,"Real UDP discovery");finder.scan(false);
            check(guest.join("127.0.0.1",19322).optBoolean("ok"),"Manual TCP join");
            String peer=await(h,"peer").getString("id");
            guest.send("host",new JSONObject("{\"t\":\"hello\",\"name\":\"粉粉🐷\"}"));
            check(await(h,"msg").getJSONObject("msg").getString("name").equals("粉粉🐷"),"UTF-8 round trip");
            host.send(peer,new JSONObject("{\"t\":\"welcome\",\"you\":2}"));check(await(c,"msg").getJSONObject("msg").optInt("you")==2,"Seat-specific send");
            host.send("*",new JSONObject("{\"t\":\"all\"}"));check(await(c,"msg").getJSONObject("msg").optString("t").equals("all"),"Broadcast");
            try(Socket raw=new Socket("127.0.0.1",19322)){
                String rawId=await(h,"peer").getString("id");byte[] data="{\"t\":\"碎片🐷\"}\n[]\ninvalid\n".getBytes(StandardCharsets.UTF_8);
                for(byte b:data){raw.getOutputStream().write(b);raw.getOutputStream().flush();}
                check(await(h,"msg").getJSONObject("msg").getString("t").equals("碎片🐷"),"Fragmented multibyte TCP lines");
                raw.getOutputStream().write(new byte[LanNetwork.MAX_LINE+1]);raw.getOutputStream().flush();
                check(await(h,"peer-left").getString("id").equals(rawId),"Bound unterminated frames");
            }
            host.kick(peer);await(c,"closed");await(h,"peer-left");
            guest.leave();host.leave();
            check(host.host(new JSONObject()).optBoolean("ok"),"Rehost after leave");
            check(!guest.join("8.8.8.8",19322).optBoolean("ok"),"Bridge rejects internet destinations");
            StringBuilder big=new StringBuilder();for(int i=0;i<200000;i++)big.append('猪');
            check(!host.send("*",LanNetwork.json("t",big.toString())),"Byte limit includes multibyte messages");
        }
        System.out.println("PASS native LAN: local-only addresses, real UDP discovery, port fallback, TCP framing, UTF-8, targeted/broadcast send, bounded lines, kick, leave/rehost");
    }
    static void serve() throws Exception {
        try(LanNetwork lan=new LanNetwork(e->print(LanNetwork.json("event",e)));
            BufferedReader input=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8))) {
            String line;
            while((line=input.readLine())!=null){
                JSONObject request=new JSONObject(line),d=request.optJSONObject("data");if(d==null)d=new JSONObject();Object r;
                try{switch(request.optString("op")){
                    case "host":r=lan.host(d);break;case "join":r=lan.join(d.optString("host"),d.optInt("port"));break;
                    case "room":r=lan.setRoom(d);break;case "scan":r=lan.scan(d.optBoolean("on"));break;
                    case "send":r=lan.send(d.optString("to"),d.getJSONObject("msg"));break;
                    case "kick":r=lan.kick(d.optString("id"));break;case "leave":lan.scan(false);r=lan.leave();break;
                    case "info":r=lan.info();break;default:r=LanNetwork.json("ok",false,"error","unknown");
                }}catch(Exception e){r=LanNetwork.json("ok",false,"error",e.toString());}
                print(LanNetwork.json("id",request.optInt("id"),"result",r));
            }
        }
    }
}
