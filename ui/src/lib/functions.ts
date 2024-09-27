



export function getSearchTokens(search:string){
    let parts = search.split("||");
    let tokens:string[][] = [];
    parts.forEach((p)=>{
        let combT = p.split("&&")
        let comb:string[] = []
        combT.forEach((c)=>{
            if(c != ""){
                comb.push(c.trim())
            }
        })
        if(comb.length != 0){
            tokens.push(comb);
        }
    })

    return tokens;
}


export function tokenSearch(input:string|any, tokens:string[][], keys:string[]|null = null){
    if(tokens.length == 0){
        return true;
    }
    if(keys){
        
    }else{
        input = { "text" : input };
        keys = ["text"];
    }

    let found = false;
    
    

    tokens.forEach((token:string[])=>{
        let combFound = true;
        token.forEach((comb)=>{
            let keyFound = false;
            keys.forEach((k)=>{
                if(input[k].search(new RegExp(comb, "i")) != -1){
                    keyFound = true
                }
            });
            if(!keyFound){
                combFound = false;
            }
        });

        if(combFound){
            found = true;
        }
    });

    return found;
}