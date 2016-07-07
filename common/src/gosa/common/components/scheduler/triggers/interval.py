# This file is part of the GOsa framework.
#
#  http://gosa-project.org
#
# Copyright:
#  (C) 2016 GONICUS GmbH, Germany, http://www.gonicus.de
#
# See the LICENSE file in the project's top-level directory for details.

import datetime
from math import ceil

from gosa.common.components.scheduler.util import convert_to_datetime, timedelta_seconds


class IntervalTrigger(object):
    def __init__(self, interval, start_date=None):
        if not isinstance(interval, datetime.timedelta):
            raise TypeError('interval must be a timedelta')
        if start_date:
            start_date = convert_to_datetime(start_date)

        self.interval = interval
        self.interval_length = timedelta_seconds(self.interval)
        if self.interval_length == 0:
            self.interval = datetime.timedelta(seconds=1)
            self.interval_length = 1

        if start_date is None:
            self.start_date = datetime.datetime.now() + self.interval
        else:
            self.start_date = convert_to_datetime(start_date)

    def get_next_fire_time(self, start_date):
        if start_date < self.start_date:
            return self.start_date

        timediff_seconds = timedelta_seconds(start_date - self.start_date)
        next_interval_num = int(ceil(timediff_seconds / self.interval_length))
        return self.start_date + self.interval * next_interval_num

    def __str__(self):
        return 'interval[%s]' % str(self.interval)

    def __repr__(self):
        return "<%s (interval=%s, start_date=%s)>" % (
            self.__class__.__name__, repr(self.interval),
            repr(self.start_date))
