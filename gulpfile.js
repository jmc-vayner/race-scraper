/*globals require*/
"use strict";

// GULP FILE
const gulp      = require('gulp'),
    _           = require('lodash'),
    util        = require('util'),
    Plugins     = require('gulp-load-plugins'),
    Promise     = require('bluebird'),
    request     = require('request-promise'),
    exec        = require('child_process').exec,
    fs          = require('fs'),
    vo          = require('vo'),
    Nightmare   = require('nightmare');

const plugins = Plugins({
    DEBUG: false,
    camelize: true,
    pattern: ['*'],
    scope: ['devDependencies'],
    replaceString: /^gulp(-|\.)/,
    lazy: false
});

gulp.task('scrape', done => {
    let run = function*() {
        const nightmare = Nightmare({show: true});
        let nextExists = true;
        let currentPage = 0;
        let rows = [];

        yield nightmare
            .goto('http://registration.baa.org/2018/cf/Public/iframe_EntryLists.cfm')
            .select("[name='GenderID']", "1")
            .click(".submit_button")
            .wait(".tablegrid_nav")

        nextExists = yield nightmare.visible('input[name="next"]');

        const header = yield nightmare
            .wait(1000)
            .inject('js', 'node_modules/jquery/dist/jquery.min.js')
            .evaluate(() => {
                return $(".tablegrid_table thead tr th").toArray().map((header) => {
                    return $(header).text();
                });
            });
        header.filter(n => true);
        // header.push('\n');
        const headerString = header.join().replace(/name/i, 'Last,First');
        rows.push(headerString);

        while(nextExists && currentPage < 5) {
            console.log('page ===>', currentPage)
            let row = yield nightmare
                .wait(1000)
                .inject('js', 'node_modules/jquery/dist/jquery.min.js')
                .evaluate(() => {
                    const rows = $(".tablegrid_table tbody tr").toArray().map((row) => {
                        const cells = $(row).find("td").toArray().map((cell) => {
                            const cellText = $(cell).text();
                            return $.trim(cellText);
                        });
                        return cells.join();
                    });
                    rows.splice(-2, 2);
                    return rows.join('\n');
                })

            rows = rows.concat(row);
            // rows.join('\n');

            yield nightmare
                .click('input[name="next"]')
                .wait('.tablegrid_nav')

            currentPage++;
            nextExists = yield nightmare.visible('input[name="next"]');
        }

        yield nightmare.end()

        return rows.join('\n');
    }

    vo(run)
        .then(results => {
            console.log(results);
        })
        .catch(err => {
            console.log(err);
        });
})

gulp.task('scrapeNYRR', done => {
    request({
        url: "http://results.nyrr.org/api/runners/finishers",
        method: "POST",
        headers: {
            'Content-Type': 'application/json;charset=UTF-8'
        },
        body: {
            eventCode:      "H2017",
            sortColumn:     "overallTime",
            sortDescending: false,
            pageIndex:      1,
            pageSize:       2
        },
        json: true
    })
    .then(results => {
        return results.response.items;
    })
    .mapSeries((result, index, length) => {
        console.log(result.runnerId);
        return request({
            url: 'http://results.nyrr.org/api/runners/resultDetails',
            method: "POST",
            headers: {
                "Content-Type": "application/json;charset=UTF-8"
            },
            body: {"runnerId": result.runnerId},
            json: true
        })
        .then(results => {return results;})
        // .delay(1000)
    })
    .then(results => {
        console.log('assadf');
        console.log(util.inspect(results, {colors: true, depth: 5}));
        done();
    })
    .catch(err => {
        console.log(err);
        done();
    })
    // http://results.nyrr.org/api/runners/finishers {"eventCode":"H2017","runnerId":null,"searchString":null,"gender":null,"handicap":null,"ageGroup":null,"sortColumn":"overallTime","sortDescending":false,"city":null,"pageIndex":2,"pageSize":2000}
    // http://results.nyrr.org/api/runners/resultDetails {"runnerId":10714900}
    // http://results.nyrr.org/api/runners/details {"runnerId":10714900}

})
