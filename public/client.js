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
// TODO check if the path in the url bar exists. if so, automatically go to it.
// if not, revert to root path as cwd and change pathname in url bar.
let [_, ...cwpath] = location.pathname == '/' ? [] : location.pathname.split('/')
let history = new CommandHistory
let env = Object.create(null)
env["cwd"] = location.pathname


// turns any path into a canonical absolute path
function canonicalize(path) {
  if(path == "/")
    return "/"
  
  let components = path.split("/")
  
  if (components[0] == "") {
    // path is absolute
    components.shift()
  }
  // path is relative; resolve with current directory
  else {
    let cwd = env["cwd"]
    if(!cwd.endsWith('/')) cwd += '/'
    components = (cwd + path).split('/')
    components.shift()
  }

  // remove any double-dots
  for (let i = 0; i < components.length;) {
    if (components[i] == "..") {
      if (i == 0) {
        // just remove any double-dot immediately after root
        components.shift()
      }
      else {
        // convert each ["dirname", ".."] to []
        components.splice(i - 1, 2)
        i -= 1 // bc we rm prev pos
      }
      continue
    }
    i += 1
  }
  
  return "/" + components.join('/')
}

// take a path and uses it to walk down the tree.
// assumes path is canonical.
function opendir(path) {
  if(path == "/")
    return root_fs
  
  let components = path.split('/')
  components.shift()
  return components.reduce((dir, name) => dir[name], root_fs)
}

function evnop(e) {
    e.preventDefault()
    e.stopPropagation()
}


input.addEventListener("keyup", evt => {
    evt.preventDefault()
    evt.stopPropagation()
    
    if (evt.key == "Enter") {
      let div = document.createElement("div")
      div.innerHTML = `<kbd>${input.value}</kbd>`
      div.classList.add("input")
      output.appendChild(div)

      // there can be 2 situations:
      // * a new command is sent, and is then pushed to the history
      //   stack
      // * an old command is re-entered, and is then moved to the
      //   end of the stack
      let cmd = history.at_latest() ?
        history.push(input.value)
        : history.fetch()
      
      // run the command!
      run(cmd)
      
      // reset input buffer
      input.value = ""
      // scroll down to show the result
      output.scrollTop = output.scrollTopMax
    }
    // History navigation
    else if (evt.key == "ArrowUp") {
      input.value = history.up()
    }
    else if (evt.key == "ArrowDown") {
      input.value = history.down()
    }
})



// need these bc browser opens the file otherwise
window.addEventListener("dragexit", evnop)
window.addEventListener("dragover", evnop)
window.addEventListener("drop", evt => {
    evt.preventDefault()
    evt.stopPropagation()
    
    for(let file of evt.dataTransfer.files) {
        let cwd = deref_path(env["cwd"])
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
    let [cmd, ...args] = command.trim().split(/\s+/).filter(s => s.length > 0)
    
    // TODO: how to handle function output in general
    let ctx = {
        root_fs, opendir, canonicalize, env,
        
        cwd: opendir(env["cwd"]),
        out: output,
        
        is_file(obj) {
            return obj instanceof Blob //|| obj instanceof URL
        },
        
        is_dir(obj) {
            return !this.is_file(obj) && typeof obj == "object"
        },
        
        // open file. if it doesn't exist, create it
        open(path) {
          let split_path = canonicalize(path).split('/')
            let parent = canonicalize(path)
            
            let name = parent.pop()
            parent = opendir(parent)
            
            if (!(name in parent)) {
                parent[name] = new Blob
            }
            
            return parent[name]
        },
        
        save(path, data) {
            let parent = canonicalize(path)
            let name = parent.pop()
            parent = opendir(parent)
            
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
            return span.outerHTML
        },
        
        ediv(str = "") {
            let elem = document.createElement("div")
            elem.classList.add("error")
            elem.innerHTML = `<b>${cmd}</b>: ${str}`
            return elem
        },
        
        println(str) {
            let out = document.createElement("div")
            out.classList.add("output")
            out.innerHTML = `<b>${cmd}</b>: ${str}`
            output.appendChild(out)
            output.scrollTop = output.scrollTopMax
        },
        
        eprintln(str) {
            let out = document.createElement("div")
            out.classList.add("error")
            out.innerHTML = `<b>${cmd}</b>: ${str}`
            output.appendChild(out)
            output.scrollTop = output.scrollTopMax
        },
        
        show(str) {
            let out = document.createElement("div")
            out.classList.add("output")
            out.innerHTML = `<b>${cmd}</b>: <div>${str}</div>`
            output.appendChild(out)
            output.scrollTop = output.scrollTopMax
        },
        
        eshow(str) {
            let out = document.createElement("div")
            out.classList.add("error")
            out.innerHTML = `<b>${cmd}</b>: <div>${str}</div>`
            output.appendChild(out)
            output.scrollTop = output.scrollTopMax
        },
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