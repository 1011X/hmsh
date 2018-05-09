// stores and keeps track of which command line is being pointed to
class CommandHistory {
  constructor() {
    this.lines = []
    this.pos = 0
  }
  
  // returns true if no previous command is being pointed to
  at_latest() {
    return this.pos == this.lines.length
  }
  
  // point to previous command
  up() {
    this.pos = Math.max(0, this.pos - 1)
    // the default empty string is needed for when there's nothing
    // in the history stack yet
    return this.lines[this.pos] || ""
  }
  
  // point to next command
  down() {
    this.pos = Math.min(this.lines.length, this.pos + 1)
    return this.lines[this.pos] || ""
  }
  
  // pushes new command line to the end of the history stack and
  // returns its value
  push(line) {
    this.lines.push(line)
    this.pos += 1
    return line
  }
  
  // moves current command line to the end of the history stack
  // and returns its value
  fetch() {
    //console.assert(this.pos < this.lines.length)
    // take current line from the stack
    let line = this.lines.splice(this.pos, 1)[0]
    // push it to the end of the stack
    this.lines.push(line)
    this.pos = this.lines.length
    // return it
    return line
  }
}