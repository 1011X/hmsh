// client-side js
// run by the browser each time your view template is loaded


// TODO ideas:
// * look at features in `window.console`
// * pipes, but maintain data and its structure
// * > < and >> redirectors
// * pipes and `tee`
// * pre-parse arguments?
// * scroll output on new content
// * MutationObserver for autoscroll on new stuff

// RULES:
// * DON'T generalize WebWorkers to all commands. Let the command
//   implement it itself.

let input = document.getElementById("input")
let output = document.getElementById("output")
var cwddiv = document.getElementById("cwd")
cwddiv.textContent = location.pathname

let root_fs = Object.create(null)
let [_, ...cwpath] = location.pathname == '/' ? [] : location.pathname.split('/')
let cmd_hist = []
let hist_idx = 0
let env = Object.create(null)
env['CWD'] = location.pathname


// turns any path into an absolute path
function resolve_path(path) {
    path = path.split("/")
    
    // if path is absolute
    if (path[0] == "") {
        // path is the root
        if (path[1] == "") { path = [] }
        else { path.shift() }
    }
    // pash is relative; resolve with cwpath
    else {
        path = cwpath.concat(path)
    }
    
    // remove any double-dots
    // start at end of cwpath, since it won't have double-dots
    for (let i = cwpath.length; i < path.length;) {
        if (path[i] == "..") {
            // just remove any double-dot immediately after root
            if (i == 0) { path.shift() }
            else {
                // convert each ["dirname", ".."] to []
                path.splice(i - 1, 2)
                i -= 1 // bc we rm prev pos
            }
            continue
        }
        i += 1
    }
    
    return path
}

// takes an array of strings (path components) and uses them
// to walk down the tree
function deref_path(path) {
    return path.reduce((dir, name) => dir[name], root_fs)
}

function evnop(e) {
    e.preventDefault()
    e.stopPropagation()
}


input.addEventListener("keyup", evt => {
    evt.preventDefault()
    evt.stopPropagation()
    
    if (evt.key == "Enter") {
        let pre = document.createElement("pre")
        pre.innerHTML = `/${cwpath.join("/")}> <kbd>${input.value}</kbd>`
        pre.classList.add("input")
        output.appendChild(pre)
        
        run(input.value)
        
        // if index points somewhere, place at end of list
        if (hist_idx < cmd_hist.length) {
            let [cmd] = cmd_hist.splice(hist_idx, 1)
            hist_idx = cmd_hist.push(cmd)
        }
        else {
            hist_idx = cmd_hist.push(input.value)
        }
        
        input.value = ""
        output.scrollTop = output.scrollTopMax
    }
    // History
    else if (evt.key == "ArrowUp") {
        hist_idx -= 1
        hist_idx = Math.max(0, hist_idx)
        
        input.value = cmd_hist[hist_idx]
    }
    else if (evt.key == "ArrowDown") {
        hist_idx += 1
        hist_idx = Math.min(cmd_hist.length, hist_idx)
        
        if (hist_idx == cmd_hist.length) {
            input.value = ""
        }
        else {
            input.value = cmd_hist[hist_idx]
        }
    }
})

// need these bc browser opens file if we don't have them
window.addEventListener("dragexit", evnop)
window.addEventListener("dragover", evnop)
window.addEventListener("drop", evt => {
    evt.preventDefault()
    evt.stopPropagation()
    
    for(let file of evt.dataTransfer.files) {
        let cwd = cwpath.reduce((dir, name) => dir[name], root_fs)
        let out = document.createElement("div")
        
        cwd[file.name] = file
        out.innerHTML = `Loaded file. Name: "${file.name}", size: ${file.size} bytes`
        output.appendChild(out)
    }
    
    output.scrollTop = output.scrollTopMax
})

function run(command) {
    /*
    input = input.trim()
    let sep = input.indexOf(/\s/)
    let cmd = input.substring(0, sep)
    let args_str = input.substring(sep).trimLeft()
    
    // process args
    let args = Object.create(null)
    for (let arg of args_arr) {
        if (arg.startsWith("--")) {
            args[arg] = args_arr[arg]
        }
        else {
            args.splice(0, args.indexOf(arg))
            break
        }
    }
    */
    let [cmd, ...args] = command.trim().split(" ").filter(s => s.length > 0)
    
    // TODO: how to handle function output in general
    let ctx = {
        cwpath, root_fs, deref_path, resolve_path, env,
        
        cwd: deref_path(cwpath),
        out: output,
        
        is_file(obj) {
            return obj instanceof Blob //|| obj instanceof URL
        },
        
        is_dir(obj) {
            return !this.is_file(obj) && typeof obj == "object"
        },
        
        // open file. if it doesn't exist, create it
        open(path) {
            let parent = resolve_path(path)
            let name = parent.pop()
            parent = deref_path(parent)
            
            if (!(name in parent)) {
                parent[name] = new Blob
            }
            
            return parent[name]
        },
        
        save(path, data) {
            let parent = resolve_path(path)
            let name = parent.pop()
            parent = deref_path(parent)
            
            parent[name] = new File([data], name)
        },
        
        path_link(path, name = `/${path.join('/')}`) {
            let span = document.createElement("span")
            function handler(ev) {
                input.value += " " + ev.currentTarget.dataset["path"]
                input.focus()
            }
            span.classList.add("path")
            span.dataset["path"] = "/" + path.join('/')
            span.setAttribute("tabindex", "0")
            span.addEventListener("click", handler)
            // if it's keydown, it'll execute as a command
            span.addEventListener("keyup", ev => {
                if (ev.key == "Enter") { handler(ev) }   
            })
            span.textContent = name
            return span
        },
        
        div(str = "") {
            let elem = document.createElement("div")
            elem.innerHTML = `<b>${cmd}</b>: ${str}`
            return elem
        },
        
        ediv(str = "") {
            let elem = this.div(str)
            elem.classList.add("error")
            return elem
        },
        
        print(str, elem = "div") {
            let out = document.createElement(elem)
            out.innerHTML = `<b>${cmd}</b>: ${str}`
            output.appendChild(out)
            output.scrollTop = output.scrollTopMax
        },
        
        eprint(str) {
            let out = document.createElement("div")
            out.classList.add("error")
            out.innerHTML = `<b>${cmd}</b>: ${str}`
            output.appendChild(out)
            output.scrollTop = output.scrollTopMax
        }
    }
    
    if (commands[cmd]) {
        try {
            commands[cmd](ctx, args)
        }
        catch (err) {
            let out = document.createElement("div")
            out.classList.add("error")
            out.innerHTML = `<b>${cmd}</b>: ${err}`
            output.appendChild(out)
        }
    }
    else { // no such command found
        let out = document.createElement("div")
        out.classList.add("error")
        out.innerHTML = `Command not found: <kbd>${cmd}</kbd>`
        output.appendChild(out)
    }
    
    output.scrollTop = output.scrollTopMax
}