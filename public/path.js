class Path {
  constructor(path) {
    // TODO checks
    this.path = path
  }
  
  // returns the stored path
  toString() {
    this.path
  }
  
  // starts with a root
  is_absolute() {
    return this.path.startsWith('/')
  }
  
  // is not absolute
  is_relative() {
    return !this.is_absolute()
  }
  
  // appends the given component to the end of the path.
  // if argument is an absolute path, it replaces the whole path.
  push(path) {
    let p = new Path(path)
    if(p.is_absolute())
      this.path = path
    else
      this.path += '/' + path
  }
  
  // truncates `this` to `this.parent()` and returns true
  // if undefined, does nothing and returns false
  pop() {
    if(!this.file_name())
      return false
    
    
    return true
  }
}