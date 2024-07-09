const { JSDOM } = require('jsdom');

function generateI (html) {
    let doc = getDoc(html);
    let generateIndex1 = generateIndex(doc)
    this.indexNo = generateIndex1
    console.log(generateIndex1)
}
function getDoc (html) {
    var title = []

    const dom = new JSDOM(html);
    const document = dom.window.document;
    // this.sleep(5000).then(() => {
    //     // 这里写sleep之后需要去做的事情
    // })
    // let collection = new  HTMLCollection
    collection = document.body.children
    for (var i = 0; i < collection.length; i++) {
        let tagName = collection[i].tagName
        let text = collection[i].innerText
        let id = collection[i].id
        // console.log(tagName)
        // console.log(text)
        // console.log(text)
        if (tagName.startsWith('H')) {
            title.push({tag: tagName, text: text, id: id})
        }
    }
    return title
}

function generateIndex (title) {
    let indexNo = []
    if (title.length === 1) {
        indexNo.push({tag: title[0].text, indexNo: []})
        return indexNo
    }
    // for (let i1 = 0; i1 < title.length; i1++) {
    //   for (let j = i1 + 1; j < title.length; j++) {
    //     if (title[i1].tag === title[j].tag) {
    //       if (j - i1 > 1) {
    //         // eslint-disable-next-line no-unused-vars
    //         let subTitle = title.slice(i1 + 1, j + 1)
    //         let tempIndex = this.generateIndex(subTitle)
    //         indexNo.push({tag: title[i1].text, indexNo: tempIndex})
    //         i1 = j + 1
    //         break
    //       } else if (j - i1 === 1) {
    //         indexNo.push({tag: title[i1].text, indexNo: []})
    //         break
    //       }
    //     } else if (j === title.length - 1) {
    //       let subTitle = title.slice(i1 + 1, j + 1)
    //       let tempIndex = this.generateIndex(subTitle)
    //       indexNo.push({tag: title[i1].text, indexNo: tempIndex})
    //       return indexNo
    //     }
    //   }
    // }
    console.log(Date.now())
    for (let i1 = 0; i1 < title.length; i1++) {
        for (let j = i1 + 1; j < title.length; j++) {
            if (title[i1].tag === title[j].tag) {
                if (j - i1 > 1) {
                    // eslint-disable-next-line no-unused-vars
                    let subTitle = title.slice(i1 + 1, j)
                    let tempIndex = generateIndex(subTitle)
                    indexNo.push({tag: title[i1].text, id: title[i1].id, indexNo: tempIndex})
                    i1 = j - 1
                    break
                } else if (j - i1 === 1) {
                    indexNo.push({tag: title[i1].text, id: title[i1].id, indexNo: []})
                    if (j === title.length - 1) {
                        indexNo.push({tag: title[j].text, id: title[j].id, indexNo: []})
                    }
                    break
                }
            } else if (j === title.length - 1) {
                let subTitle = title.slice(i1 + 1, j + 1)
                let tempIndex = generateIndex(subTitle)
                indexNo.push({tag: title[i1].text, id: title[i1].id, indexNo: tempIndex})
                i1 = j
                break
            }
        }
    }

    return indexNo
}

// 对外暴露方法
module.exports = {
   generateI
};