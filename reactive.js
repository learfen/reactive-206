const keyOutputContainer = 'linked'
const methodNameAfterUpdate = 'mutations'
const methodNameBeforeUpdate = 'middleware'
const waitInspectMutations = 50
const ignoreSetter = [
    keyOutputContainer,
    'keyOutputContainer',
    'methodNameAfterUpdate',
    'methodNameBeforeUpdate',
    'after',
    'before',
    'nodes',
    'sync',
    'output'
]

let reactiveNodes = {}
let reactiveStorageComponents = i => {}
/*
let reactiveList =new Proxy({}, {
        set( obj , key , value  ){
            obj[key] = value 
            waitInspectDom()
        },
        get(obj , key){
            if(key) return obj[key]
            return obj
        }
})

const waitInspectDom = list => {
    let all = list ?? reactiveStorageComponents()
    for(let item in all ){
        reactiveFindDom( all[item] )
    }
}
*/
const reactiveBase = (obj , base ) => {
    if( obj[methodNameBeforeUpdate] == undefined ) base[methodNameBeforeUpdate] = obj['before'] ?? {}
    if( obj[methodNameAfterUpdate] == undefined ) base[methodNameAfterUpdate] = obj['after'] ?? {}
    if( obj[keyOutputContainer] == undefined ) base[keyOutputContainer] = {}
    obj['__isReactive'] = true
    return obj
} 

const proxyParent = ( obj , parent ) => {
    obj['__isParent'] = () => parent 
    return obj
}

const setterValue = (obj , baseReactive) => {
    for(let k in obj){
        if(ignoreSetter.indexOf(k) == -1){
            if(typeof obj[k] == 'function') baseReactive[k] = obj[k]
            else if(obj[k] != 'object') baseReactive[k] = obj[k]
            else{
                baseReactive[k] = obj[k]['__isReactive'] ? obj[k] : reactive(obj[k])
                if(obj[k]['__isReactive']){
                    baseReactive[k]['__isParent'] = () => baseReactive[k]
                }
            }
        }
    }
    return baseReactive
}

const reactiveTypeObject = (obj , methodProxy ) => {
    let add = { ...obj }
    obj = new Proxy( setterValue( obj , reactiveBase(obj,{}) ) , methodProxy)
    for(let k in add){
        if(ignoreSetter.indexOf(k) == -1) {
            if(typeof add[k] == 'object'){
                add[k].__isKey = k
                add[k].__isParent = ()=> obj 
                add[k]= reactive(add[k])
            }
            let value = reactive(add[k])
            obj[k] = value.primitive ?? value
        }
    }
    return obj
}

const reactiveSetPrimitive = ( obj ) => {
    let objText = String(obj)
    for(let item in reactiveStorageComponents() ){
        if(item.search('__') != 0){
            if(objText.search('<'+item+'>') > -1){
                objText = objText.split('<'+item+'>').join('<'+item+'>'+reactiveStorageComponents()[item])
            }
        }
    }
    if(obj != objText){
        obj = objText
        setTimeout(()=>{
            // waitInspectDom()
        }, 100)
    }
    return obj
}

const reactiveTypeArray = ( obj , methodProxy) => {
    // methods arrays
    obj = new Proxy( obj , methodProxy ) 
    obj['_push'] = obj['push']
    obj['_splice'] = obj['splice']
    obj['push'] = function( value , x) {
        const length = this.length
        if( !value.primitive ){
            value['__isParent'] = () => this
            value['__isKey'] = length
        }
        value = reactive(value)
        this._push( value.primitive ?? value )
        mutationsAfterDom(obj.__isParent() , length , value )
        return this
    }
    obj['splice'] = function( value , valueEnd) {
        this._splice( value , valueEnd )
        obj.__isParent()[obj.__isKey] = this
        return reactiveSetObject(obj.__isParent(), obj.__isKey , this)
    }
    for(let k in obj){
        obj[k] = reactive( obj[k] )
        obj[k] = obj[k].primitive ?? obj[k]
        if( typeof obj[k] == 'object'){
            obj[k]['__isKey'] = k
            obj[k]['__isParent'] = () => obj
        }
    }
    return obj
}

const reactiveFindDom = objString=>{
    if(objString.sync){
        for(let x in objString.sync){
            let nodes = objString.sync[x]()
            if(!Array.isArray(nodes)) {
                if(nodes['length'] != undefined)
                    nodes = Array.from(nodes)
                else
                    nodes = [ nodes ]
            }

            if(!reactiveNodes[x]) reactiveNodes[x] = []
            for(let node of nodes){
                reactiveNodes[x].push( node )
            }
        }
        //delete objString.sync
    }
    if(objString.output){
        for(let x in objString.output){
            let nodes = objString.output[x]()
            if(!Array.isArray(nodes)) {
                if(nodes['length'] != undefined)
                    nodes = Array.from(nodes)
                else
                    nodes = [ nodes ]
            }
            if(!reactiveNodes[x]) reactiveNodes[x] = []
            for(let node of nodes){
                reactiveNodes[x].push( node )
            }
        }
        //delete objString.output
    }
}

const reactive = ( objString , refStore )=>{
    objString = objString ?? {}
    if(typeof objString == 'object') reactiveFindDom(objString)
    const methodProxy= {
        'object':{ get:reactiveGetObject , set:reactiveSetObject },
        'array':{ get:reactiveGetArray , set:reactiveSetArray }
    }
    const exe = obj => {
        if( obj['__isReactive'] ) return obj
        if(typeof obj == 'function') return obj
        obj['__isReactive'] = true
        if( Array.isArray( obj ) ) return reactiveTypeArray( obj , methodProxy['array'])
        if( typeof obj == 'object' ){ 
            return reactiveTypeObject( obj , methodProxy['object'] )
        }
        return reactiveSetPrimitive( obj )
    }
    let result = exe( objString )
    if( refStore ) {
        result.isRef = refStore
        reactiveRefsStore[ refStore ] = result
    }
    return result
}
const randstr = (prefix) => {
    return Math.random().toString(36).replace('0.',prefix || '');
}

const reactiveGetObject = (obj , key) => {
    if(key) return obj[key]
    return obj
}
const reactiveGetArray = (obj , key) => {
    if(key) return obj[key]
    return obj
}

const reactiveSetArray = (obj , key, value) => {
    obj[key] = value
    mutationsAfterDom( obj , key , value )
    return obj
}
const reactiveSetObject = ( obj , key , value ) => {
    let reactiveKey = key.search('__') == 0
    if(reactiveKey) obj[key] = value
    if(ignoreSetter.indexOf(key) == -1 && !reactiveKey){
        if( typeof value == 'object' ){
            if(!value.__isParent && obj.__isReactive){
                value['__isParent'] = () => obj
            }
            value['__isParent'] = () => obj
            value['__isKey'] = key
            obj[key] = value.primitive ?? value
            obj[key] = reactive(obj[key]) 
            mutationsAfterDom( obj , key , obj[key] )       
        }else{
            obj[key] = value.primitive ?? value
            obj[key]['__isParent'] = () => obj
            obj[key] = reactive(obj[key])
            mutationsAfterDom( obj , key , obj[key] )
            
        }
    }
    return obj
}

const mutationsAfterDom = ( obj , key , value ) => {
    if(String(key).search('__') == 0) return false
    let emit = (Number.isNaN(+key) ? key : '*') + ''
    let objFind = obj
    while( objFind.__isParent ){
        emit = (Number.isNaN(+objFind.__isKey) ? objFind.__isKey : '*') + '.' + emit
        objFind = objFind.__isParent && typeof objFind.__isParent == 'function' ? objFind.__isParent() : {}
    }
    if(objFind.after ){
        for(let fnName in objFind.after){
            if(!fnName.indexOf('__') == 0){
                if(objFind.after[fnName]().join('') == '*' || objFind.after[fnName]().indexOf(emit) > -1){
                    objFind.after[fnName]( objFind , obj)
                }
            }
        }
    }
    reactiveFindDom(objFind)
    if(reactiveNodes){
        let inputs = ['INPUT','TEXTAREA','SELECT']
        setTimeout( ()=> {
            if( reactiveNodes[emit] ){
                for(let node of reactiveNodes[emit]){
                    if(node.getAttribute){
                        if(!node.getAttribute('sync') && inputs.indexOf( node.nodeName ) > -1){
                            node.setAttribute('sync', emit)
                            node.addEventListener('change', event => {
                                reactiveSetObject( obj , key ,  event.target.value )
                            })
                        }
                    }
                    try {
                        value = String(value)
                        node[ inputs.indexOf( node.nodeName ) > -1 ? 'value' : 'innerHTML'] = value                        
                    } catch (error) {
                        
                    }
                    
                    if(Array.isArray(value))
                        node[ inputs.indexOf( node.nodeName ) > -1 ? 'value' : 'innerHTML'] = value.join(',')
                }
            }
            if(objFind.c) {
                reactiveStorage.c++
            }
        } , waitInspectMutations )
    }
}
let reactiveStorage = reactive({
    render:true,
    after:{
        render( self ){
            if( self ){
                console.log(' c ', self.c)
                for(let component in self.components){
                    if(component.search('__') != 0){
                        let nodes = document.querySelectorAll(component)
                        Array.from( nodes )
                        .map( item => {
                            item.innerHTML = self.components[component]
                        } )
                    }
                }
            }
            return ['*']
        }
    }
})
reactiveStorage.components = {}
reactiveStorageComponents = () => reactiveStorage.components

const openComponent = ( url , name ) =>{
    fetch(url)
        .then( async response => {
          let text = await response.text()
          reactiveStorage.components[name] = text.split('<script>')[0]
          setTimeout(()=> {
              eval( text.split('<script>')[1].split('</\script>')[0] ) 
              // waitInspectDom( reactiveStorage.components )
            }, 200)
        })
        .catch( error => {
            console.error( error.message )
        })
}