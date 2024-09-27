


export function ComplexCompare(a:string,b:string){

    let done = false;

    let apos = 0;
    let bpos = 0;
    let amax = a.length
    let bmax = b.length

    let anum = "";
    let bnum = "";

    let numbers = ["0","1","2","3","4","5","6","7","8","9"]

    let comp = 0;
    
    while(!done){
        if(apos<amax &&bpos<bmax){
            anum = "";
            bnum = "";
            while(numbers.includes(a[apos]) && apos < amax){
                anum += a[apos]
                apos++;
            }

            while(numbers.includes(b[bpos]) && bpos < bmax){
                bnum += b[bpos]
                bpos++;
            }

            if(anum != "" && bnum != ""){
                comp = Number(anum) - Number(bnum);
                if(comp != 0){
                    return comp;
                }
            }else{
                if(anum != ""){
                    return 1
                }else if(bnum != ""){
                    return -1;
                }else{
                    comp = a[apos].localeCompare(b[bpos],undefined, { sensitivity: 'accent' });
                    if(comp != 0){
                        return comp;
                    }else{
                        apos++;
                        bpos++;
                    }
                }
            }



        }else{
            done = true;
        }
    }
    return 0;
    
}


export function ShortenNames(dev:string,flow:string){
    let name = "";
    let sync = true;
    for(let i = 0; i< flow.length; i++){
        if(i<dev.length && sync){
            if(dev[i] == flow[i]){
                // Same beginning
            }else{
                sync = false;
                name += flow[i]
            }
        }else{
            name += flow[i]
        }
    }
    return name;
}
