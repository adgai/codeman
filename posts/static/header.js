let sd = {
    isUp: false, // 判断是否是向上滚动
    changeUpDir: 0, // 设置从向下滚动到向上滚动时的位置（距离滚动条顶部）
    changeDownDir: 0, // 设置从向上滚动到向下滚动时的位置（距离滚动条顶部）
    headerFixed: false,

    topValue: getScrollTop(),
    scrollTop: 0

}

let lastTop = 0 // 设置

document.onscroll = function () {

    var scrollTop = getScrollTop() // 初始化滚动条为位置为0

    if (scrollTop <= lastTop) { // 当后者滚动条大于前者滚动条时，即认为滚动条向上运动，但是我们设置一个临界值，当大于这个临界值时，即认为是用户有意向上滚动
        sd.changeUpDir = scrollTop //  changeUpDir 这个是 刚好从向下滚动到向上滚动改变方向时的位置
        if (sd.changeDownDir - scrollTop > 120) { // 这个是else 里面记录的值减滚动条位置 大于120 即认为是向上滚动
            sd.isUp = false
        }
    } else {
        sd.changeDownDir = scrollTop
        if (scrollTop - sd.changeUpDir > 120) {
            sd.isUp = true
        }
    }
    // sd.isUp = scrollTop - lastTop

    sd.headerFixed = scrollTop > 60

    setTimeout(function () {
        lastTop = scrollTop
    }, 0)

    console.log('isUp     ' + sd.isUp)
    if (sd.isUp) {
        document.getElementsByClassName('PageHeader')[0].classList.add('is-shown')
        document.getElementsByClassName('header')[0].classList.add('is-hidden')

    } else {
        document.getElementsByClassName('header')[0].classList.remove('is-hidden')
        document.getElementsByClassName('PageHeader')[0].classList.remove('is-shown')
    }

    // console.log(scrollTop)
    // console.log('headerFixed     ' + sd.headerFixed)
    if (sd.headerFixed) {
        document.getElementsByClassName('header')[0].classList.add('is-fixed')
    } else {
        document.getElementsByClassName('header')[0].classList.remove('is-fixed')
    }


    // console.log('--------------------------------')
}

function getScrollTop() { // 获取滚动条位置
    var scrollTop = 0
    if (document.documentElement && document.documentElement.scrollTop) {
        scrollTop = document.documentElement.scrollTop
    } else if (document.body) {
        scrollTop = document.body.scrollTop
    }
    return scrollTop
}