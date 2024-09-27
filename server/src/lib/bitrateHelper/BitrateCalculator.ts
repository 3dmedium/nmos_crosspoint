export class BitrateCalculator {
    static dmt = require('./dmt_timings.js');
    static vic = require('./vic_timings.js');

static audioFlow = {
    encoding:"raw",
    sampleRate:48000 ,
    channels:2,
    depth:24,
    samplesPerPacket:48,
    vlan:false,
};

static videoFlow = {
    encoding:"raw",
    width:3840 ,
    height:2160,
    fps:50,
    interlaced:false,
    depth:10,
    sampling:"YCbCr422",
    gapped: true,
    gpm:false,
    shape:"narrow-linear",
    vlan:false,

    blanking:"dmt"
};

static timing_proto = {
    valid : false,
    source : "none",
    h_active: 0,
    v_active: 0,
    interlaced: false,
    h_total: 0,
    h_blank: 0,
    v_total: 0,
    v_blank: 0
};


// TODO Licesnsing DMT   https://tomverbeure.github.io/video_timings_calculator
static lookupDmt (horiz_pixels, vert_pixels, refresh_rate, interlaced){
   let t = JSON.parse(JSON.stringify(BitrateCalculator.timing_proto));
   t.interlaced = interlaced;



    BitrateCalculator.dmt.timings.forEach(function(timing, index){
        if (   timing['h_active'] == horiz_pixels 
            && timing['v_active'] == vert_pixels 
            && timing['v_freq'].toFixed()   == refresh_rate.toFixed() 
            && timing['interlaced'] == interlaced
        ){
            t.h_active     = horiz_pixels;
            t.h_blank      = timing['h_blank'];
            t.h_total      = timing['h_total'];

            t.v_active     = vert_pixels;
            t.v_blank      = timing['v_blank'];
            t.v_total      = timing['v_total'];

            t.valid = true;
            t.source = "dmt"
        }
    });

    return t;
}
static lookupVic(horiz_pixels, vert_pixels, refresh_rate, interlaced){
    let t = JSON.parse(JSON.stringify(BitrateCalculator.timing_proto));
    t.interlaced = interlaced;
    BitrateCalculator.vic.timings.forEach(function(timing, index){

         if (   timing['h_active'] == horiz_pixels 
             && timing['v_active'] == vert_pixels 
             && timing['v_freq'].toFixed()   == refresh_rate.toFixed() 
             && timing['interlaced'] == interlaced
         ){
             t.h_active     = horiz_pixels;
             t.h_blank      = timing['h_blank'];
             t.h_total      = timing['h_total'];
 
             t.v_active     = vert_pixels;
             t.v_blank      = timing['v_blank'];
             t.v_total      = timing['v_total'];
 
             t.valid = true;
             t.source = "vic"
         }
     });
 
     return t;
 }


 static calculateTiming (horiz_pixels, vert_pixels, refresh_rate, interlaced, mode ="cvt"){
    let t = JSON.parse(JSON.stringify(BitrateCalculator.timing_proto));
    t.interlaced = interlaced;
    t.h_active = horiz_pixels;
    t.v_active = vert_pixels;

    
    
    t.h_blank = 160;

    let field_rate = interlaced ? refresh_rate * 2 : refresh_rate;
    let lines = interlaced ? vert_pixels / 2 : vert_pixels;

    let min_v_porch = 3
    let min_v_bporch        = 6;
    let v_sync = 10;  // Largest Value for all aspects
    let min_vsync_bp  = 550;

    
    if(mode == "rb"){
        
    }else if(mode == "rbv2"){
        t.h_blank = 80;
        v_sync = 8;
    }else{
        //mode cvt

        
        let h_period_estimate = ((1 / field_rate) - min_vsync_bp / 1000000.0) / (lines  + min_v_porch + interlaced) * 1000000.0;
        
        let IDEAL_DUTY_CYCLE = 30 - (300 * h_period_estimate/1000);

        if (IDEAL_DUTY_CYCLE < 20){
            t.h_blank = Math.floor(vert_pixels * 20 / (100-20) / (2 * 8)) * (2 * 8);
        }else{
            t.h_blank = Math.floor(vert_pixels * IDEAL_DUTY_CYCLE / (100 - IDEAL_DUTY_CYCLE) / (2 * 8)) * (2 * 8);
        }
        
        t.h_blank = Math.floor(vert_pixels * 20 / (100-20) / (2 * 8)) * (2 * 8);

        let v_sync_bp = Math.floor(min_vsync_bp / h_period_estimate) + 1;
        if (v_sync_bp < (v_sync + min_v_bporch)){
            v_sync_bp = v_sync + min_v_bporch;
        }

        t.v_blank = v_sync_bp + min_v_porch;
    }

    t.h_total = t.h_active + t.h_blank;
    t.v_total = t.v_active + t.v_blank;
    t.valid = true;
    t.source = "calc"
    return t;
 }





static calculateVideo(f){
    // Constants
    let headerSize = {
        physical:8 + 4 + 12,
        ethernet:14,
        ip:20,
        udp:8,
        rtp:16+6,
        payload:1400
    };
    if(f.vlan){
        headerSize.ethernet = headerSize.ethernet + 4;
    }
    let o = {
        averageEthernet:0,
        averagePacket:0,
        averageMedia:0,
        pps:0, ppf:0, packetSize:0,

        maxRate:0,
        bufferRate:0,
        bufferSize:0,

        interPacketTimeAvg:0,
        interPacketTimeMin:0,
        interPacketTimeLine:0,
        interPacketTimeFrame:0,
    };
    let height = f.height;
    

    let pixelEncodingBlockBytes = 0;
    let pixelEncodingBlockPixels = 0;

    let samplingdepth = ""+f.sampling+f.depth;

    switch(samplingdepth){
        case "YCbCr42210":
            pixelEncodingBlockBytes = 5;
            pixelEncodingBlockPixels = 2;
            break;
        case "YCbCr4228":
            pixelEncodingBlockBytes = 4;
            pixelEncodingBlockPixels = 2;
            break;
        case "RGB4448":
            pixelEncodingBlockBytes = 3;
            pixelEncodingBlockPixels = 1;
            break;
        case "RGB44410":
            pixelEncodingBlockBytes = 15;
            pixelEncodingBlockPixels = 4;
            break;
        case "RGB44412":
            pixelEncodingBlockBytes = 9;
            pixelEncodingBlockPixels = 2;
            break;
    }


    if(pixelEncodingBlockPixels == 0){
        console.error("Pixel Sampling ot Depth not supported." + samplingdepth);
        return o;
    }

    if(f.width % pixelEncodingBlockPixels != 0){
        console.error("Width can not be encoded in given Sampling.")
        return o;
    }

    let maxPixelsPerPacket = Math.floor(headerSize.payload/pixelEncodingBlockBytes)*pixelEncodingBlockPixels;
    if(!f.gpm){
        //Block Packing Mode
        let num = 0;
        for( num = Math.floor(f.width / maxPixelsPerPacket)+1; f.width % num != 0; num++){

        }
        
        maxPixelsPerPacket = f.width / num;

    }

    let packetsPerFrame = Math.floor(f.width*height/maxPixelsPerPacket);
    if(f.gpm){
        packetsPerFrame++;
    }
    let totalPayloadSize = f.width*height*pixelEncodingBlockBytes/pixelEncodingBlockPixels;

    let totalPacketSize = totalPayloadSize + (packetsPerFrame * (headerSize.ethernet + headerSize.ip + headerSize.udp + headerSize.rtp));
    let totalFrameSize = totalPayloadSize + (packetsPerFrame * (headerSize.physical + headerSize.ethernet + headerSize.ip + headerSize.udp + headerSize.rtp));

    o.pps = packetsPerFrame * f.fps;
    o.ppf = packetsPerFrame;
    o.averagePacket = totalPacketSize * f.fps * 8;
    o.averageEthernet = totalFrameSize * f.fps * 8;
    o.averageMedia = totalPayloadSize * f.fps * 8;
    o.packetSize = maxPixelsPerPacket * pixelEncodingBlockBytes/pixelEncodingBlockPixels +  (headerSize.ethernet + headerSize.ip + headerSize.udp + headerSize.rtp)


    // Timings
    let timing = BitrateCalculator.lookupVic(f.width, f.height, f.fps, f.interlaced);
    if(!timing.valid){
        timing = BitrateCalculator.lookupDmt(f.width, height, f.fps, f.interlaced);
    }
    if(!timing.valid){
        timing = BitrateCalculator.calculateTiming(f.width, height, f.fps, f.interlaced);
    }

    let pixelsPerSecond = timing.h_total * timing.v_total * f.fps;
    let activePixelsPerSecond = timing.h_active * timing.v_active * f.fps;
    o.interPacketTimeAvg = 1 / (packetsPerFrame * f.fps);
    o.interPacketTimeMin = 1 /( pixelsPerSecond/maxPixelsPerPacket);
    o.interPacketTimeLine =  1/pixelsPerSecond * (timing.h_total - timing.h_active + maxPixelsPerPacket);
    o.interPacketTimeFrame = 1/pixelsPerSecond * (timing.h_total - timing.h_active + maxPixelsPerPacket + ( (timing.v_total - timing.v_active) * timing.h_total ) );

    // TODO Differences for narrow linear

    // Calculate Max Rate
    o.maxRate = o.averageEthernet / activePixelsPerSecond * pixelsPerSecond;

    // Calculate Buffer Rate
    o.bufferRate = o.averageEthernet / timing.v_active * timing.v_total;
    if(f.shape == "narrow-linear"){
        o.maxRate = o.bufferRate;
        o.interPacketTimeMin = 1 / (packetsPerFrame * f.fps / timing.v_active * timing.v_total);
        o.interPacketTimeLine = o.interPacketTimeMin;
        if(!f.gapped){
            o.maxRate = o.averageEthernet;
            o.bufferRate = o.averageEthernet
        }
    }
    
    
    // Calculate Buffer Size (2 Lines)
    o.bufferSize = o.bufferRate / f.fps / timing.v_total * 2 / 8;
    if(f.shape == "wide"){
        // TODO Half a frame ????
        o.bufferSize = o.bufferRate / f.fps / 2 / 8;
    }

    return o;
};

static calculateAudio(f){
    // Constants
    let headerSize = {
        physical:8 + 4 + 12,
        ethernet:14,
        ip:20,
        udp:8,
        rtp:16,
        payload:1400
    };
    if(f.vlan){
        headerSize.ethernet = headerSize.ethernet + 4;
    }
    let o = {
        averageEthernet:0,
        averagePacket:0,
        averageMedia:0,
        pps:0, ppf:0, packetSize:0,

        maxRate:0,
        bufferRate:0,
        bufferSize:0,

        interPacketTimeAvg:0,
        interPacketTimeMin:0,
        interPacketTimeLine:0,
        interPacketTimeFrame:0,
    };
    let bytesPerSample = Math.floor((f.depth+1) / 8);
    let totalPayloadSize = f.sampleRate * f.channels * bytesPerSample;

    o.pps = f.sampleRate / f.samplesPerPacket;

    let totalPacketSize = totalPayloadSize + (o.pps * (headerSize.ethernet + headerSize.ip + headerSize.udp + headerSize.rtp));
    let totalFrameSize = totalPayloadSize + (o.pps * (headerSize.physical + headerSize.ethernet + headerSize.ip + headerSize.udp + headerSize.rtp));



    
    o.ppf = 1;

    o.averagePacket = totalPacketSize * 8;
    o.averageEthernet = totalFrameSize  * 8;
    o.averageMedia = totalPayloadSize * 8;
    o.packetSize = (f.samplesPerPacket * f.channels * bytesPerSample) + (headerSize.ethernet + headerSize.ip + headerSize.udp + headerSize.rtp);


    
    o.interPacketTimeAvg = 1 / o.pps;
    o.interPacketTimeMin =  o.interPacketTimeAvg
    o.interPacketTimeLine =  o.interPacketTimeAvg
    o.interPacketTimeFrame =  o.interPacketTimeAvg

    // TODO Differences for narrow linear

    // Calculate Max Rate
    o.maxRate = o.averageEthernet;

    // Calculate Buffer Rate
    o.bufferRate = o.averageEthernet;
    
    
    // Calculate Buffer Size //TODO ho large ???
    // 0.25 seconds ????
    o.bufferSize = totalFrameSize * o.pps * 0.25;

    return o;
};
}