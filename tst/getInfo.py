import numpy as np
import json
import plotly.plotly as py
from plotly.graph_objs import *


class executionData(object):
    def __init__(self, arg):
        super(executionData, self).__init__()
        self.parseData(arg)

    def parseData(self, data):
        self.sols = []
        self.times = []
        for d in data['results']:
            self.sols.append(float(d['r']))
            self.times.append(float(d['t']))

    def getStd(self):
        return {'sols': np.std(self.sols), 'times': np.std(self.times)}

    def getMean(self):
        meanSols = sum(self.sols) / len(self.sols)
        meanTimes = sum(self.times) / len(self.times)
        return {'sols': meanSols, 'times': meanTimes}

    def getData(self):
        return {'sols': self.sols, 'times': self.times}


def plotTimes(dosDataMngr, saDataMngr):
    x = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']
    fontType1 = Font(
        family='Open sans',
        size=18,
        color='#444444'
    )
    fontType2 = Font(
        family='Open sans',
        size=16,
        color='#444444'
    )

    dosTimesBar = Bar(
        x=x,
        y=dosDataMngr.getData()['times'],
        name='DOS execution times'
    )
    saTimesBar = Bar(
        x=x,
        y=saDataMngr.getData()['times'],
        name='SA (standalone mode) execution times'
    )
    plotTimesData = Data([dosTimesBar, saTimesBar])
    layout = Layout(
        barmode='group',
        title='DOS vs. SA (standalone mode) Execution Times',
        titlefont=fontType1,
        xaxis=XAxis(
            title='Execution',
            titlefont=fontType1,
            autotick=False,
            tickfont=fontType2,
        ),
        yaxis=YAxis(
            title='Execution Time (seconds)',
            titlefont=fontType1,
            tickfont=fontType2,
        ),
        tickfont=fontType2,
        legend=Legend(
            font=fontType2
        )
    )

    figTimes = Figure(data=plotTimesData, layout=layout)
    py.image.save_as(figTimes, 'execution-times-plot.pdf')
    plot_url = py.plot(figTimes, filename='execution-times-plot')


def plotResults(dosDataMngr, saDataMngr):
    x = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']
    fontType1 = Font(
        family='Open sans',
        size=18,
        color='#444444'
    )
    fontType2 = Font(
        family='Open sans',
        size=16,
        color='#444444'
    )

    dosResultsBar = Bar(
        x=x,
        y=dosDataMngr.getData()['sols'],
        name='DOS execution results'
    )
    saResultsBar = Bar(
        x=x,
        y=saDataMngr.getData()['sols'],
        name='SA (standalone mode) execution results'
    )
    plotResultsData = Data([dosResultsBar, saResultsBar])
    layout = Layout(
        barmode='group',
        title='DOS vs. SA (standalone mode) Execution Results',
        titlefont=fontType1,
        xaxis=XAxis(
            title='Execution',
            titlefont=fontType1,
            autotick=False,
            tickfont=fontType2,

        ),
        yaxis=YAxis(
            title='Execution Result',
            titlefont=fontType1,
            tickfont=fontType2,
        ),
        legend=Legend(
            font=fontType2
        )
    )

    figResults = Figure(data=plotResultsData, layout=layout)
    py.image.save_as(figResults, 'execution-results-plot.pdf')
    plot_url = py.plot(figResults, filename='execution-results-plot')

if __name__ == '__main__':
    dosData = json.load(open('DOS/results.json'))
    saData = json.load(open('SA/results.json'))

    dosDataMngr = executionData(dosData)
    saDataMngr = executionData(saData)

    print('\n\n------ DOS ------')
    print('\n==== SOLUTIONS ====')
    print('Mean: ' + str(dosDataMngr.getMean()['sols']))
    print('Standard Deviation: ' + str(dosDataMngr.getStd()['sols']))

    print('\n==== EXECUTION TIMES ====')
    print('Mean: ' + str(dosDataMngr.getMean()['times']))
    print('Standard Deviation: ' + str(dosDataMngr.getStd()['times']))

    print('\n------ SA ------')
    print('\n==== SOLUTIONS ====')
    print('Mean: ' + str(saDataMngr.getMean()['sols']))
    print('Standard Deviation: ' + str(saDataMngr.getStd()['sols']))

    print('\n==== EXECUTION TIMES ====')
    print('Mean: ' + str(saDataMngr.getMean()['times']))
    print('Standard Deviation: ' + str(saDataMngr.getStd()['times']) + '\n\n')

    plotTimes(dosDataMngr, saDataMngr)
    plotResults(dosDataMngr, saDataMngr)
