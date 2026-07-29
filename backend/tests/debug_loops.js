import { parseCppAST } from '../services/astParser.js'

const code = `int main() {
  for (int i = 0; i < 5; i++)
    for (int j = 0; j < 5; j++)
      std::cout << i * j;
}`
const ast = parseCppAST(code)
console.log('maxNestDepth:', ast.maxNestDepth)
console.log('loops depth values:', ast.loops.map(l => `depth=${l.depth} kw=${l.keyword}`).join(', '))
