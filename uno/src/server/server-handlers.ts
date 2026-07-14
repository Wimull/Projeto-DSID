// Funções acessadas pela front end com a função `send(nomeDoHandler)` 


function serverHandlers(port: number) {
  const handlers = {

  
  _history: [] as number[],
  
'make-factorial' : async ({ num }: { num: number }) => {
  handlers._history.push(num)
  
  function fact(n: number): number {
    if (n === 1) {
      return 1
    }
    return n * fact(n - 1)
  }
  
  console.log('making factorial')
  return fact(num)
},

'ring-ring' : async () => {
  console.log('picking up the phone')
  return 'hello!'
}
}
return handlers
}

export default serverHandlers