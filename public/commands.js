// FIXME: handle errors in all commands that use the first argument
var commands = {

// print back arguments
echo(ctx, args) {
  let separate_with_spaces = true
  let interpret_escapes = false

  for (let arg of args) {
    if (arg == "-s") {
      separate_with_spaces = false
    }
    else if (arg == "-e") {
      interpret_escapes = true
    }
    else if (arg == "-E") {
      interpret_escapes = false
    }
    else {
      args.splice(0, args.indexOf(arg))
      break
    }
  }

  ctx.println(args.join(separate_with_spaces ? " " : ""))
    /*
    MAIN:
    let w = new Worker("echo.js")
    
    w.onmessage = evt => {
        if (evt.data.cmd == "print") {
            ctx.print(evt.data.msg)
        }
        else if (evt.data.cmd == "show") {
            ctx.out.innerHTML += evt.data.msg
        }
    }
    
    w.postMessage(args)
    
    WORKER:
    function echo(...args) {
        ...
        postMessage({
            cmd: "print",
            msg: args.join(separate_with_spaces ? " " : "")
        })
    }

    onmessage = function(e) {
        echo(...e.data)
        close()
    }
    */
},

// print markdown-formatted text
//format(ctx, args) {}

// list files and folders in cwd
ls(ctx, args) {
    let path = args[0] || "."
    let list = dir_expand(path)
    
    function dir_expand(path) {
        let dir = ctx.opendir(path)
        let ul = document.createElement("ul")
        
        for (let name in dir) {
            let file_path = [...path, name]
            
            if (ctx.is_dir(dir[name])) {
                let details = document.createElement("details")
                let summary = document.createElement("summary")
                let files = dir_expand(file_path)
                
                summary.appendChild(ctx.path_link(file_path, name))
                details.appendChild(summary)
                
                if (files.childElementCount == 0) {
                    let div = document.createElement("div")
                    div.innerHTML = "<i>Nothing in this directory</i>"
                    details.appendChild(div)
                } else {
                    details.appendChild(files)
                }
                
                ul.appendChild(details)
            }
            else {
                let li = document.createElement("li")
                
                li.appendChild(ctx.path_link(file_path, name))
                ul.appendChild(li)
            }
        }
        
        return ul
    }
    
    if (list.childElementCount == 0) {
        ctx.println("This directory is empty.")
    }
    else {
        ctx.out.appendChild(list)
    }
},

// creates new directories in current working directory of the
// virtual filesystem
mkdir(ctx, args) {
  for(let arg of args) {
    /*let req = new Request(ctx.env["cwd"], {
      method: "POST",
      body: "mkdir " + arg,
    })*/
    ctx.cwd[arg] = Object.create(null)
    ctx.println(`Folder "${arg}" created`)
  }
},

// remove file or directory
rm(ctx, args) {
    for (let path of args) {
        let absolute_path = ctx.canonicalize(path)
        // FIXME: finish making Path class so .pop() works
        let name = path.pop()
        let parent = ctx.opendir(path)
        
        // cwd is a child directory whose parent is about to be deleted
        if (ctx.env["cwd"].startsWith(absolute_path)) {
            ctx.eprintln("Can't delete parent of current directory.")
            ctx.eprintln(`Path: ${ctx.path_link(path)}`)
            ctx.eprintln(`CWD: ${ctx.path_link(ctx.env["CWD"])}`)
            return
        }
        
        if (!parent[name]) {
            ctx.eprintln(`No such file or directory: ${path}`)
            return
        }
        
        delete parent[name]
        ctx.println(`Deleted /${absolute_path}`)
    }
},

// change current directory
cd(ctx, args) {
  if(args[0] == undefined) {
    throw "No path given"
  }
  
  let path = ctx.canonicalize(args[0])
  let newcwd = ctx.opendir(path)

  // error when dereferencing path
  if (newcwd == undefined) {
      throw `Directory does not exist: <kbd>${args[0]}</kbd>`
  }

  if (!ctx.is_dir(newcwd)) {
      throw `Not a directory: <kbd>${args[0]}</kbd>`
  }

  ctx.env["cwd"] = path

  // update cwd div
  let p = ctx.env["cwd"]
  window.cwddiv.textContent = p
  // TODO: hm, do something with this?
  window.history.pushState({}, null, p)
  ctx.println(`Now in <kbd>${p}</kbd>`)
},

// present media on output display
show(ctx, args) {
    let file = ctx.open(ctx.canonicalize(args[0]))
    let reader = new FileReader
    let scroll_update = () => {output.scroll(0, output.scrollTopMax)}
    
    if (file instanceof URL) {
        window.open(file.href)
    }
    else if (file.type.startsWith("image")) {
        let img = document.createElement("img")
        img.addEventListener("load", scroll_update)
        
        reader.addEventListener("load", () => {
            img.src = reader.result;
        });
        
        reader.readAsDataURL(file)
        ctx.out.appendChild(img)
    }
    else if (file.type.startsWith("video")) {
        let video = document.createElement("video")
        video.addEventListener("load", scroll_update)
        
        video.controls = true
        video.autoplay = true
        reader.addEventListener("load", () => {
            video.src = reader.result;
        });
        
        reader.readAsDataURL(file)
        ctx.out.appendChild(video)
    }
    else if (file.type.startsWith("audio")) {
        let audio = document.createElement("audio")
        
        audio.controls = true
        reader.addEventListener("load", () => {
            audio.src = reader.result;
        });
        
        reader.readAsDataURL(file)
        ctx.out.appendChild(audio)
    }
    else if (file.type == "text/html" || file.name.endsWith("html")) {
        let parser = new DOMParser()
        
        reader.addEventListener("load", () => {
            let html = parser.parseFromString(reader.result, "text/html")
            // just append the whole bod. that seems to work fine
            ctx.out.appendChild(html.body)
        });
        
        reader.readAsText(file)
    }
    // SOON
    //else if (file.type == "text/markdown") {}
    else if (file.type == "text/plain" || file.name.endsWith(".txt")) {
        reader.addEventListener("load", () => {
            // make it look pretty
            ctx.out.innerHTML += reader.result.replace(/\n/g, "<br/>")
        })
        
        reader.readAsText(file)
    }
    else {
        throw `Don't know how to open <kbd>${file.name}</kbd>`
    }
},

help(ctx, args) {
    ctx.println("Files can be imported by drag-and-drop.")
    ctx.println("Current directory is shown above the input box and in the address bar.")
    ctx.println("Underlined paths can be added to the input box by clicking on them.")
    
    ctx.println("Here's some available commands:")
    
    let dl = document.createElement("dl")
    let descriptions = {
        "cd": "Change current directory to given path",
        "clear": "Clear the display",
        "echo": "Displays a string of text",
        "ed": "Edit text files",
        //"fetch": "Tries to fetch and store a resource",
        "help": "Display help information",
        //"ln": "Link to a web address",
        "ls": "List file information in a directory",
        "mkdir": "Make directory if it doesn't already exist",
        "rm": "Remove a file or directory",
        "show": "Display some files presentable by the browser",
    }
    
    for(let cmd in descriptions) {
        let dt = document.createElement("dt")
        dt.textContent = cmd
        
        let dd = document.createElement("dd")
        dd.textContent = descriptions[cmd]
        
        dl.appendChild(dt)
        dl.appendChild(dd)
    }
    
    ctx.println(dl.innerHTML)
},

// FIXME: doesn't work, even with CORS-enabled sites T.T
/*
fetch(ctx, args) {
    // get url first
    let url = args.pop()
    
    if (!url.startsWith("http://")) {
        url = "http://" + url
    }
    
    url = new URL(url) // throws if malformed
    
    // figure out name
    let name = "default"
    
    // derive from url pathname
    if (!url.pathname.endsWith("/")) {
        let i = url.pathname.lastIndexOf("/")
        name = url.pathname.slice(i)
    }
    
    // derive from name given
    if (args.some(e => e == "-o" || e == "--out")) {
        let i = args.findIndex(e => e == "-o" || e == "--out") + 1
        
        // no name given
        if (i == args.length) {
            throw "No name given"
        }
        
        // contains '/' (invalid name)
        if (args[i].includes("/")) {
            throw `Invalid name: ${args[i]}`
        }
        
        name = args[i]
    }
    
    // finally, fetch!
    fetch(url.href)
    .then(res => res.blob()) // parse as blob
    .then(res => { // got something!
        ctx.cwd[name] = res
        ctx.print("Success!")
    })
    .catch(ctx.eprint) // failed
},

// create web link file to an address
ln(ctx, args) {
    let url = args.pop()
    let name = args.pop()
    
    ctx.cwd[name + ".url"] = new URL(url)
    ctx.print("Link created")
},
*/
// clears all output in display
clear(ctx, _) {
    ctx.out.innerHTML = ""
},

/*
// copies file in cwd into folder path
cp(ctx, args) {
    let dest = ctx.canonicalize(args.pop())
    let src = ctx.canonicalize(args.pop())
    
    if (ctx.is_file(src) && ctx.is_file(dest)) {
        
    }
},

// moves file in cwd to have the given path
mv(ctx, args) {},

// list processes
ps(ctx, args) {},

// end processes
end(ctx, args) {},
*/

// opens file with full text editor capabilities
ed(ctx, args) {
    let filename = args[0] || "default.txt"
    let path = ctx.canonicalize(filename)
    let file = ctx.open(path)
    
    if (ctx.is_dir(file)) {
        throw `Not a file: <kbd>${filename}</kbd>`
    }
    
    console.assert(ctx.is_file(file), "Neither a folder nor a file was given!")
    
    let textarea = document.createElement("textarea")
    let save_button = document.createElement("button")
    let reader = new FileReader
    
    reader.addEventListener("load", evt => {
        textarea.value = reader.result
    })
    
    save_button.textContent = "Save"
    save_button.addEventListener("click", function save(evt) {
        ctx.save(path, textarea.value)
        textarea.textContent = textarea.value
        save_button.removeEventListener("click", save)
        save_button.disabled = true
        textarea.disabled = true
        ctx.println("Saved")
    })
    
    reader.readAsText(file)
    ctx.out.appendChild(textarea)
    ctx.out.appendChild(document.createElement("br"))
    ctx.out.appendChild(save_button)
},

}