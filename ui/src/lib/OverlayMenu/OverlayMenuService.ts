import { ReplaySubject, Observable, Subject, BehaviorSubject } from 'rxjs';
import { TestTools } from 'rxjs/internal/util/Immediate';


class _OverlayMenuService {
    openMenus:any[] = [];
    menuObservable:Subject<any>;
    tooltipObservable:Subject<any>;
    tooltipData = {
        active:false,
        uipos:{y:0,x:0},
        text:""
    }
    constructor (){
        this.menuObservable = new Subject<any>();
        this.menuObservable.next([])
        this.tooltipObservable = new Subject<any>();
        this.tooltipObservable.next( {
            active:false,
            uipos:{y:0,x:0},
            text:""
        });
    }

    open(menu:any, event:any = null){
        this.openMenus = []
        menu["pos"] = {x:0,y:0}
        if(event){
            event.stopPropagation();
            menu["pos"] = {x:0,y:0}
            menu["pos"]["x"] = event.x;
            menu["pos"]["y"] = event.y;
        }
        
        this.openMenus.push(menu);
        this.menuObservable.next(this.openMenus);
    }
    close(index:number){
        this.openMenus.splice(index,1);
        this.menuObservable.next(this.openMenus);
    }
    closeAll(){
        this.openMenus = [];
        this.menuObservable.next(this.openMenus);

    }


    tooltip(element:any){
        let text:string = element.getAttribute("data-tooltip");
        let position:string = element.getAttribute("data-tooltip-position");
        let p = ["right","bottom"];
        try{
            if(position){
                p = position.split(",");
            }
        }catch(e){}

        element.addEventListener("mouseover", (event:any) => {

            let r = element.getBoundingClientRect();
            let y = 0;
            let x = 0;

            let mx = 0;
            let my = 0;


            if( p[0] == "right"){
                x = r.x+r.width;
                mx = 0;  
            }
            if( p[0] == "center"){
                x = r.x + r.width/2;
                mx = 50;  
            }
            if( p[0] == "left"){
                x = r.x;
                mx = 100;  
            }


            if( p[1] == "top"){
                y = r.y;
                my = 100;  
            }
            if( p[1] == "middle"){
                y = r.y + r.height/2;
                my = 50;  
            }
            if( p[1] == "bottom"){
                y = r.y + r.height;
                my = 0;  
            }

            this.tooltipObservable.next({
                    active:true,
                    uipos:{
                        x:x,y:y,
                        mx:mx,
                        my:my,
                    },
                    text:text
            })
        })
        element.addEventListener("mouseout", (ev:any) => {
            this.tooltipObservable.next({
                active:false,
                uipos:{y:0,x:0},
                text:""
        })
        })
    }

};

const OverlayMenuService: _OverlayMenuService = new _OverlayMenuService();
export default OverlayMenuService;

